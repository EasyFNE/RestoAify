// Edge Function : invite-user
// Crée un utilisateur Supabase Auth + public.users + tenant_users
// Déployer : supabase functions deploy invite-user
//
// Permissions : utilise la SERVICE_ROLE key (disponible automatiquement
// dans les Edge Functions via Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Client admin (service_role) — ne jamais exposer cette clé au frontend
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── Client appelant (anon) — vérifie que l'appelant est bien authentifié
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Payload
    const { tenant_id, email, full_name, role_code, password } = await req.json()

    if (!tenant_id || !email || !password) {
      return new Response(JSON.stringify({ error: 'tenant_id, email et password sont requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rôles valides alignés sur CHECK constraint DB
    const VALID_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer']
    const safeRole = VALID_ROLES.includes(role_code) ? role_code : 'member'

    // ── 1. Créer le compte dans auth.users
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,   // confirme directement sans attendre l'email
      user_metadata: {
        full_name,
        tenant_id,
        role: safeRole,
      },
    })
    if (createError) throw createError
    const newAuthUser = authData.user

    // ── 2. Insérer dans public.users
    const { error: userInsertError } = await supabaseAdmin
      .from('users')
      .insert({
        id:         newAuthUser.id,
        email,
        full_name:  full_name || email.split('@')[0],
        status:     'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    if (userInsertError) throw userInsertError

    // ── 3. Lier au tenant dans tenant_users
    const { data: link, error: linkError } = await supabaseAdmin
      .from('tenant_users')
      .insert({
        tenant_id,
        user_id:    newAuthUser.id,
        role_code:  safeRole,
        status:     'active',
        created_at: new Date().toISOString(),
      })
      .select('*, user:users(*)')
      .single()
    if (linkError) throw linkError

    return new Response(JSON.stringify({ member: link }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
