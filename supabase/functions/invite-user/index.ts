import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user: caller }, error: callerErr } = await supabaseUser.auth.getUser()
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { tenant_id, email, full_name, role_code } = body

    if (!tenant_id || !email) {
      return new Response(JSON.stringify({ error: 'tenant_id et email sont requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const VALID_ROLES = ['tenant_admin', 'manager', 'staff', 'kitchen']
    const safeRole = VALID_ROLES.includes(role_code) ? role_code : 'staff'

    const { data: callerMembership, error: memberErr } = await supabaseAdmin
      .from('tenant_users')
      .select('role_code')
      .eq('tenant_id', tenant_id)
      .eq('user_id', caller.id)
      .eq('status', 'active')
      .maybeSingle()

    if (memberErr || !callerMembership) {
      return new Response(JSON.stringify({ error: 'Accès refusé à ce tenant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const allowedCallerRoles = ['tenant_owner', 'tenant_admin']
    if (!allowedCallerRoles.includes(callerMembership.role_code)) {
      return new Response(JSON.stringify({ error: 'Droits insuffisants pour inviter un utilisateur' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: full_name || email.split('@')[0] },
        redirectTo: `${Deno.env.get('APP_URL') ?? ''}/set-password`,
      },
    )

    if (inviteErr) {
      if (!inviteErr.message?.includes('already been registered')) {
        return new Response(JSON.stringify({ error: inviteErr.message }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const authUserId = inviteData?.user?.id
    if (!authUserId) {
      const { data: existingList } = await supabaseAdmin.auth.admin.listUsers()
      const existing = existingList?.users?.find((u: { email?: string }) => u.email === email)
      if (!existing) {
        return new Response(JSON.stringify({ error: "Impossible de retrouver l'utilisateur" }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      await supabaseAdmin.from('users').upsert({
        id: existing.id,
        email,
        full_name: full_name || email.split('@')[0],
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

      const { data: existingLink } = await supabaseAdmin
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('user_id', existing.id)
        .maybeSingle()

      if (existingLink) {
        return new Response(JSON.stringify({ error: 'Cet utilisateur est déjà membre de ce tenant' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: link, error: linkErr } = await supabaseAdmin
        .from('tenant_users')
        .insert({ tenant_id, user_id: existing.id, role_code: safeRole, status: 'active' })
        .select('*, user:users(*)')
        .single()

      if (linkErr) throw linkErr
      return new Response(JSON.stringify({ member: link }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: upsertErr } = await supabaseAdmin.from('users').upsert({
      id: authUserId,
      email,
      full_name: full_name || email.split('@')[0],
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (upsertErr) throw upsertErr

    const { data: member, error: memberInsertErr } = await supabaseAdmin
      .from('tenant_users')
      .insert({ tenant_id, user_id: authUserId, role_code: safeRole, status: 'active' })
      .select('*, user:users(*)')
      .single()

    if (memberInsertErr) throw memberInsertErr

    return new Response(JSON.stringify({ member }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
