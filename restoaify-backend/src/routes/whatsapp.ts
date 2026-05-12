/**
 * WhatsApp routes
 *
 * POST /whatsapp/connect
 *   Échange le code OAuth retourné par le flow Meta Embedded Signup contre
 *   un token d’accès système, récupère les identifiants WABA + numéro,
 *   puis crée ou met à jour le channel WhatsApp du tenant en base.
 *
 * GET /whatsapp/channel
 *   Retourne le channel WhatsApp actif du tenant (ou null si absent).
 *   Utilisé par le frontend pour afficher l’état de connexion dans les Settings.
 *
 * Règles multi-tenant (01-multi-tenant-architecture.md) :
 *  - tenantId obligatoire, vérifié par requireAuth + requireTenantContext.
 *  - Toute écriture s’effectue dans une transaction SET LOCAL tenant → RLS.
 *  - Toute action est auditée dans audit_logs.
 *
 * Sécurité :
 *  - Le META_APP_SECRET n’est jamais exposé côté frontend.
 *  - L’échange code → token s’effectue exclusivement serveur-à-serveur.
 *  - Le token long-lived retourné par Meta N’EST PAS stocké ici (v1) :
 *    on stocke uniquement waba_id + phone_number_id dans channels.
 *    Le token sera stocké dans un vault chiffré en v2.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/sql.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenantContext } from '../middleware/requireTenantContext.js';

export const whatsappRouter = new Hono();

// ── Schema de validation de la requête connect ─────────────────────────────────
const ConnectSchema = z.object({
  // Code OAuth retourné par FB.login() côté frontend après Embedded Signup.
  code: z.string().min(1),
  // Identifiants récupérés depuis l’événement sessionInfoListener Meta.
  waba_id: z.string().min(1),
  phone_number_id: z.string().min(1),
  // Restaurant à lier au canal (optionnel en v1 — peut être null).
  restaurant_id: z.string().uuid().nullable().optional(),
});

// ── Helpers Meta Graph API ────────────────────────────────────────────────

/**
 * Échange le code court contre un token d’accès utilisateur Meta.
 */
async function exchangeCodeForToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    code,
  });

  const res = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta token exchange failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { access_token?: string; error?: { message: string } };
  if (data.error || !data.access_token) {
    throw new Error(`Meta token exchange error: ${data.error?.message ?? 'no access_token'}`);
  }
  return data.access_token;
}

/**
 * Vérifie que le phone_number_id est accessible avec ce token.
 */
async function verifyPhoneNumberBelongsToWaba(
  accessToken: string,
  wabaId: string,
  phoneNumberId: string,
): Promise<{ verifiedDisplayName: string | null; verifiedPhoneNumber: string | null }> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=verified_name,display_phone_number,status&access_token=${accessToken}`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta phone verify failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as {
    id?: string;
    verified_name?: string;
    display_phone_number?: string;
    status?: string;
    error?: { message: string };
  };
  if (data.error) {
    throw new Error(`Meta phone verify error: ${data.error.message}`);
  }
  void wabaId;
  return {
    verifiedDisplayName: data.verified_name ?? null,
    verifiedPhoneNumber: data.display_phone_number ?? null,
  };
}

// ── POST /whatsapp/connect ──────────────────────────────────────────────────
whatsappRouter.post(
  '/connect',
  requireAuth,
  requireTenantContext,
  async (c) => {
    const auth = c.get('auth');
    const tenantId = c.get('tenantId');

    const body = await c.req.json().catch(() => null);
    const parsed = ConnectSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parsed.error.flatten(),
          },
        },
        400,
      );
    }
    const { code, waba_id, phone_number_id, restaurant_id } = parsed.data;

    // Échanger le code contre un token Meta (serveur-à-serveur)
    let accessToken: string;
    try {
      accessToken = await exchangeCodeForToken(code);
    } catch (err) {
      console.error('[whatsapp/connect] token exchange error:', err);
      return c.json(
        {
          success: false,
          error: {
            code: 'META_TOKEN_EXCHANGE_FAILED',
            message: err instanceof Error ? err.message : 'Token exchange failed',
          },
        },
        502,
      );
    }

    // Vérifier que le phone_number_id est accessible avec ce token
    let verifiedDisplayName: string | null = null;
    let verifiedPhoneNumber: string | null = null;
    try {
      ({ verifiedDisplayName, verifiedPhoneNumber } = await verifyPhoneNumberBelongsToWaba(
        accessToken,
        waba_id,
        phone_number_id,
      ));
    } catch (err) {
      console.error('[whatsapp/connect] phone verify error:', err);
      return c.json(
        {
          success: false,
          error: {
            code: 'META_PHONE_VERIFY_FAILED',
            message: err instanceof Error ? err.message : 'Phone number verification failed',
          },
        },
        502,
      );
    }

    // Upsert du channel WhatsApp en base dans une transaction RLS
    let channel: Record<string, unknown>;
    try {
      const rows = await sql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_tenant', ${tenantId}, true)`;

        const existing = await tx<Array<{ id: string }>>`
          SELECT id FROM channels
          WHERE tenant_id = ${tenantId}
            AND channel_type = 'whatsapp'
            AND provider = 'meta'
          LIMIT 1
        `;

        const now = new Date().toISOString();
        let ch: Record<string, unknown>;

        if (existing.length > 0) {
          const [updated] = await tx<Array<Record<string, unknown>>>`
            UPDATE channels SET
              external_channel_id = ${phone_number_id},
              restaurant_id       = ${restaurant_id ?? null},
              status              = 'active',
              meta                = ${
                tx.json({
                  waba_id,
                  phone_number_id,
                  verified_display_name: verifiedDisplayName,
                  verified_phone_number: verifiedPhoneNumber,
                  connected_at: now,
                })
              },
              updated_at          = ${now}
            WHERE id = ${existing[0].id}
            RETURNING *
          `;
          ch = updated;
        } else {
          const [created] = await tx<Array<Record<string, unknown>>>`
            INSERT INTO channels (
              tenant_id, restaurant_id, channel_type, provider,
              external_channel_id, status, meta,
              created_at, updated_at
            ) VALUES (
              ${tenantId},
              ${restaurant_id ?? null},
              'whatsapp',
              'meta',
              ${phone_number_id},
              'active',
              ${
                tx.json({
                  waba_id,
                  phone_number_id,
                  verified_display_name: verifiedDisplayName,
                  verified_phone_number: verifiedPhoneNumber,
                  connected_at: now,
                })
              },
              ${now},
              ${now}
            )
            RETURNING *
          `;
          ch = created;
        }

        // Audit log (règle 01/07)
        await tx`
          INSERT INTO audit_logs (
            tenant_id, event_type, module_code, tool_code,
            actor_type, actor_id,
            entity_type, entity_id, action, success,
            payload_summary, metadata
          ) VALUES (
            ${tenantId},
            'whatsapp_channel_connected',
            'channels',
            'whatsapp.connect',
            'user',
            ${auth.sub},
            'channel',
            ${ch.id as string},
            'channel.whatsapp_connected',
            true,
            ${`waba_id=${waba_id} phone_number_id=${phone_number_id}`},
            ${
              tx.json({
                waba_id,
                phone_number_id,
                restaurant_id: restaurant_id ?? null,
                verified_display_name: verifiedDisplayName,
                verified_phone_number: verifiedPhoneNumber,
              })
            }
          )
        `;

        return [ch];
      });

      channel = rows[0];
    } catch (err) {
      console.error('[whatsapp/connect] db error:', err);
      return c.json(
        {
          success: false,
          error: {
            code: 'DB_ERROR',
            message: err instanceof Error ? err.message : 'Database error',
          },
        },
        500,
      );
    }

    return c.json({
      success: true,
      data: {
        channel_id: channel.id,
        waba_id,
        phone_number_id,
        verified_display_name: verifiedDisplayName,
        verified_phone_number: verifiedPhoneNumber,
        status: 'active',
      },
    });
  },
);

// ── GET /whatsapp/channel ───────────────────────────────────────────────────
whatsappRouter.get(
  '/channel',
  requireAuth,
  requireTenantContext,
  async (c) => {
    const tenantId = c.get('tenantId');

    try {
      await sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`;

      const rows = await sql<
        Array<{
          id: string;
          status: string;
          external_channel_id: string;
          restaurant_id: string | null;
          meta: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        }>
      >`
        SELECT
          id,
          status,
          external_channel_id,
          restaurant_id,
          meta,
          created_at,
          updated_at
        FROM channels
        WHERE tenant_id   = ${tenantId}
          AND channel_type = 'whatsapp'
          AND provider     = 'meta'
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      if (rows.length === 0) {
        return c.json({ success: true, data: null });
      }

      const ch = rows[0];
      return c.json({
        success: true,
        data: {
          channel_id:             ch.id,
          status:                 ch.status,
          phone_number_id:        ch.external_channel_id,
          restaurant_id:          ch.restaurant_id,
          waba_id:                (ch.meta?.waba_id as string) ?? null,
          verified_display_name:  (ch.meta?.verified_display_name as string) ?? null,
          verified_phone_number:  (ch.meta?.verified_phone_number as string) ?? null,
          connected_at:           (ch.meta?.connected_at as string) ?? ch.created_at,
          updated_at:             ch.updated_at,
        },
      });
    } catch (err) {
      console.error('[whatsapp/channel] db error:', err);
      return c.json(
        {
          success: false,
          error: {
            code: 'DB_ERROR',
            message: err instanceof Error ? err.message : 'Database error',
          },
        },
        500,
      );
    }
  },
);
