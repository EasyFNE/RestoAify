// Unified data access façade.
// Components import from here only — they never know if data comes
// from mocks or Supabase. Switch via VITE_DATA_SOURCE in .env.
//
// EVERY method that touches tenant-scoped data takes `tenantId` as an
// explicit argument. This mirrors the multi-tenant principle from
// 01-multi-tenant-architecture.md: tenant context is mandatory.

import { seed } from './mockData.js'
import { supabase } from './supabaseClient.js'

const SOURCE = import.meta.env.VITE_DATA_SOURCE || 'mock'

// In-memory mutable copy so create/update operations work in mock mode.
const db = JSON.parse(JSON.stringify(seed))

const uid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })

const sleep = (ms = 120) => new Promise(r => setTimeout(r, ms))

// ─────────────────────────────────────────────────────────────────────────────
// [A] HELPERS — Operations modules
// ─────────────────────────────────────────────────────────────────────────────

// Allowed order transitions, mirrors backend ORDER_TRANSITIONS
// (06-lifecycle-status.md §3.3).
const ORDER_TRANSITIONS = [
  ['draft', 'awaiting_confirmation'],
  ['draft', 'cancelled'],
  ['awaiting_confirmation', 'confirmed'],
  ['awaiting_confirmation', 'cancelled'],
  ['confirmed', 'in_preparation'],
  ['confirmed', 'cancelled'],
  ['in_preparation', 'ready'],
  ['in_preparation', 'cancelled'],
  ['ready', 'delivered'],
  ['delivered', 'closed'],
]

function isAllowedOrderTransition(from, to) {
  if (from === to) return false
  return ORDER_TRANSITIONS.some(([f, t]) => f === from && t === to)
}

function getActorForAudit() {
  try {
    const raw = localStorage.getItem('rsaas.auth.user')
    if (!raw) return { actor_type: 'system', actor_id: null }
    const u = JSON.parse(raw)
    return { actor_type: 'user', actor_id: u?.id || null }
  } catch {
    return { actor_type: 'system', actor_id: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK plan → modules catalogue
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_PLAN_MODULES_BY_CODE = {
  starter: ['contacts', 'menus', 'orders', 'handoff'],
  pro: ['contacts', 'menus', 'orders', 'handoff', 'reservations'],
  enterprise: [
    'contacts', 'menus', 'orders', 'handoff',
    'reservations',
    'catering', 'healthy', 'healthy_subscriptions',
  ],
}

function mockPlanModulesFor(planId) {
  const plan = db.plans.find(p => p.id === planId)
  if (!plan) return []
  const codes = MOCK_PLAN_MODULES_BY_CODE[plan.code] || []
  return codes.map(code => ({
    id: `pm-${plan.code}-${code}`,
    plan_id: planId,
    module_code: code,
    included: true,
    created_at: '2025-01-01T00:00:00Z',
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

const mock = {
  // ── Tenants (platform scope)
  async listTenants() {
    await sleep()
    return [...db.tenants]
  },
  async getTenant(id) {
    await sleep()
    return db.tenants.find(t => t.id === id) || null
  },
  async createTenant(data) {
    await sleep()
    const tenant = {
      id: uid(),
      name: data.name,
      slug: data.slug,
      status: data.status || 'active',
      plan_id: data.plan_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.tenants.push(tenant)
    return tenant
  },
  async updateTenant(id, patch) {
    await sleep()
    const t = db.tenants.find(x => x.id === id)
    if (!t) throw new Error('Tenant introuvable')
    Object.assign(t, patch, { updated_at: new Date().toISOString() })
    return t
  },

  // Plan change (étape 1 — sans paiement). Met à jour tenants.plan_id et
  // écrit une ligne dans audit_logs (action 'tenant.plan_changed').
  // Étape 2 : ce sera porté par un tool backend (tenants.update_plan)
  // qui validera le paiement avant d'appliquer.
  async updateTenantPlan(tenantId, planId, opts = {}) {
    if (!tenantId || !planId) throw new Error('tenantId et planId requis')
    await sleep()
    const t = db.tenants.find(x => x.id === tenantId)
    if (!t) throw new Error('Tenant introuvable')
    const oldPlan = db.plans.find(p => p.id === t.plan_id) || null
    const newPlan = db.plans.find(p => p.id === planId)
    if (!newPlan) throw new Error('Plan inconnu')
    t.plan_id = planId
    t.updated_at = new Date().toISOString()
    db.audit_logs.unshift({
      id: uid(),
      tenant_id: tenantId,
      restaurant_id: null,
      actor_type: 'user',
      actor_id: opts.actorId || null,
      entity_type: 'tenant',
      entity_id: tenantId,
      action: 'tenant.plan_changed',
      metadata: {
        from_plan_id:   oldPlan?.id   ?? null,
        from_plan_code: oldPlan?.code ?? null,
        to_plan_id:     newPlan.id,
        to_plan_code:   newPlan.code,
        reason:         opts.reason ?? null,
      },
      created_at: new Date().toISOString(),
    })
    return { ...t }
  },

  // ── Restaurants (tenant scope)
  async listRestaurants(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    return db.restaurants.filter(r => r.tenant_id === tenantId)
  },
  async getRestaurant(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    return db.restaurants.find(r => r.id === id && r.tenant_id === tenantId) || null
  },
  async createRestaurant(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const restaurant = {
      id: uid(),
      tenant_id: tenantId,
      name: data.name,
      restaurant_type: data.restaurant_type || 'restaurant',
      timezone: data.timezone || 'Africa/Abidjan',
      currency: data.currency || 'XOF',
      address: data.address || '',
      status: data.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.restaurants.push(restaurant)
    return restaurant
  },
  async updateRestaurant(tenantId, id, patch) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const r = db.restaurants.find(x => x.id === id && x.tenant_id === tenantId)
    if (!r) throw new Error('Restaurant introuvable')
    Object.assign(r, patch, { updated_at: new Date().toISOString() })
    return r
  },
  async deactivateRestaurant(tenantId, id) {
    return mock.updateRestaurant(tenantId, id, { status: 'inactive' })
  },

  // ── Tenant users (staff)
  async listTenantUsers(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const memberships = db.tenant_users.filter(tu => tu.tenant_id === tenantId)
    return memberships.map(m => ({
      ...m,
      user: db.users.find(u => u.id === m.user_id) || null,
    }))
  },
  async createTenantUser(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const VALID_ROLES = ['tenant_owner', 'tenant_admin', 'manager', 'staff', 'kitchen']
    const role_code = VALID_ROLES.includes(data.role_code) ? data.role_code : 'staff'
    let user = db.users.find(u => u.email === data.email)
    if (!user) {
      user = {
        id: uid(),
        email: data.email,
        full_name: data.full_name || data.email.split('@')[0],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      db.users.push(user)
    }
    const link = {
      id: uid(),
      tenant_id: tenantId,
      user_id: user.id,
      role_code,
      status: 'active',
      created_at: new Date().toISOString(),
    }
    db.tenant_users.push(link)
    return { ...link, user }
  },

  // ── Restaurant users (per-restaurant access)
  async listRestaurantUsers(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    return db.restaurant_users
      .filter(ru => ru.tenant_id === tenantId)
      .map(ru => ({
        ...ru,
        user: db.users.find(u => u.id === ru.user_id) || null,
        restaurant: db.restaurants.find(r => r.id === ru.restaurant_id) || null,
      }))
  },
  async createRestaurantUser(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const VALID_ROLES = ['manager', 'staff', 'kitchen']
    const role_code = VALID_ROLES.includes(data.role_code) ? data.role_code : 'staff'
    const link = {
      id: uid(),
      tenant_id: tenantId,
      restaurant_id: data.restaurant_id,
      user_id: data.user_id,
      role_code,
      status: 'active',
      created_at: new Date().toISOString(),
    }
    db.restaurant_users.push(link)
    return {
      ...link,
      user: db.users.find(u => u.id === data.user_id) || null,
      restaurant: db.restaurants.find(r => r.id === data.restaurant_id) || null,
    }
  },
  async revokeRestaurantUser(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const idx = db.restaurant_users.findIndex(ru => ru.id === id && ru.tenant_id === tenantId)
    if (idx === -1) throw new Error('Affectation introuvable')
    db.restaurant_users.splice(idx, 1)
  },

  // ── Plans & entitlements
  async listPlans() {
    await sleep()
    return [...db.plans]
  },
  async listEntitlements(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    return db.tenant_entitlements.filter(e => e.tenant_id === tenantId)
  },
  async setEntitlement(tenantId, moduleCode, enabled) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    let e = db.tenant_entitlements.find(
      x => x.tenant_id === tenantId && x.module_code === moduleCode && !x.feature_code,
    )
    if (e) {
      e.enabled = enabled
      e.source = 'override'
      e.updated_at = new Date().toISOString()
    } else {
      e = {
        id: uid(),
        tenant_id: tenantId,
        module_code: moduleCode,
        feature_code: null,
        enabled,
        source: 'override',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      db.tenant_entitlements.push(e)
    }
    db.audit_logs.unshift({
      id: uid(),
      tenant_id: tenantId,
      actor_type: 'user',
      actor_id: null,
      entity_type: 'entitlement',
      entity_id: e.id,
      action: enabled ? 'entitlement.enabled' : 'entitlement.disabled',
      metadata: { module_code: moduleCode, source: 'override' },
      created_at: new Date().toISOString(),
    })
    return e
  },
  async listPlanModules(planId) {
    if (!planId) throw new Error('planId requis')
    await sleep()
    return mockPlanModulesFor(planId)
  },
  async syncTenantEntitlements(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const tenant = db.tenants.find(t => t.id === tenantId)
    if (!tenant?.plan_id) throw new Error('Tenant sans plan')
    const planModules = mockPlanModulesFor(tenant.plan_id)
    let count = 0
    for (const pm of planModules) {
      const existing = db.tenant_entitlements.find(
        x => x.tenant_id === tenantId && x.module_code === pm.module_code && !x.feature_code,
      )
      if (!existing) {
        db.tenant_entitlements.push({
          id: uid(),
          tenant_id: tenantId,
          module_code: pm.module_code,
          feature_code: null,
          enabled: pm.included,
          source: 'plan',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      } else if (existing.source === 'plan') {
        existing.enabled = pm.included
        existing.updated_at = new Date().toISOString()
      }
      count += 1
    }
    return count
  },

  // ── Channels
  async listChannels(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    return db.channels.filter(c => c.tenant_id === tenantId)
  },

  // ── Audit logs
  async listAuditLogs(tenantId) {
    await sleep()
    if (tenantId) return db.audit_logs.filter(a => a.tenant_id === tenantId)
    return [...db.audit_logs]
  },

  // ── [B] Conversations ────────────────────────────────────────────────────
  async listConversations(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    return db.conversations
      .filter(c => c.tenant_id === tenantId)
      .map(c => ({
        ...c,
        contact: db.contacts.find(ct => ct.id === c.contact_id) || null,
        channel: db.channels.find(ch => ch.id === c.channel_id) || null,
      }))
      .sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''))
  },
  async getConversation(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const c = db.conversations.find(x => x.id === id && x.tenant_id === tenantId)
    if (!c) return null
    return {
      ...c,
      contact: db.contacts.find(ct => ct.id === c.contact_id) || null,
      channel: db.channels.find(ch => ch.id === c.channel_id) || null,
    }
  },
  async listMessages(tenantId, conversationId) {
    if (!tenantId) throw new Error('tenantId requis')
    if (!conversationId) throw new Error('conversationId requis')
    await sleep()
    return db.messages
      .filter(m => m.tenant_id === tenantId && m.conversation_id === conversationId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  // ── [B] Contacts ─────────────────────────────────────────────────────────
  async listContacts(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    return db.contacts
      .filter(c => c.tenant_id === tenantId && c.status !== 'merged')
      .map(c => ({
        ...c,
        channels: db.contact_channels.filter(
          ch => ch.tenant_id === tenantId && ch.contact_id === c.id,
        ),
      }))
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
  },
  async getContact(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const c = db.contacts.find(x => x.id === id && x.tenant_id === tenantId)
    if (!c) return null
    return {
      ...c,
      channels: db.contact_channels.filter(
        ch => ch.tenant_id === tenantId && ch.contact_id === c.id,
      ),
    }
  },
  async createContact(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const ts = new Date().toISOString()
    const contact = {
      id: uid(),
      tenant_id: tenantId,
      default_restaurant_id: data.default_restaurant_id || null,
      full_name: data.full_name || null,
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      email: data.email || null,
      language: data.language || null,
      notes: data.notes || null,
      status: 'active',
      merged_into_id: null,
      created_at: ts,
      updated_at: ts,
    }
    db.contacts.push(contact)
    if (data.channel_type && data.channel_value) {
      db.contact_channels.push({
        id: uid(),
        tenant_id: tenantId,
        contact_id: contact.id,
        channel_type: data.channel_type,
        channel_value: data.channel_value,
        is_primary: true,
      })
    }
    const actor = getActorForAudit()
    db.audit_logs.push({
      id: uid(),
      tenant_id: tenantId,
      event_type: 'contact_created',
      module_code: 'contacts',
      tool_code: 'contacts.create',
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      entity_type: 'contact',
      entity_id: contact.id,
      action: 'contact.created',
      success: true,
      correlation_id: null,
      reason: null,
      payload_summary: `created contact ${contact.full_name || contact.email || contact.id}`,
      metadata: { has_channel: Boolean(data.channel_type) },
      created_at: ts,
    })
    return contact
  },
  async updateContact(tenantId, id, patch) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const c = db.contacts.find(x => x.id === id && x.tenant_id === tenantId)
    if (!c) throw new Error('Contact introuvable')
    const FIELDS = ['full_name', 'first_name', 'last_name', 'email', 'language', 'notes', 'status']
    const changed = []
    for (const f of FIELDS) {
      if (f in patch && patch[f] !== c[f]) {
        c[f] = patch[f] ?? null
        changed.push(f)
      }
    }
    if (changed.length === 0) return c
    const ts = new Date().toISOString()
    c.updated_at = ts
    const actor = getActorForAudit()
    db.audit_logs.push({
      id: uid(),
      tenant_id: tenantId,
      event_type: 'contact_profile_updated',
      module_code: 'contacts',
      tool_code: 'contacts.update_profile',
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      entity_type: 'contact',
      entity_id: c.id,
      action: 'contact.profile_updated',
      success: true,
      correlation_id: null,
      reason: null,
      payload_summary: `updated fields: ${changed.join(', ')}`,
      metadata: { changed_fields: changed },
      created_at: ts,
    })
    return c
  },

  // ── [B] Orders ───────────────────────────────────────────────────────────
  async listOrders(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    return db.orders
      .filter(o => o.tenant_id === tenantId)
      .map(o => ({
        ...o,
        contact: db.contacts.find(c => c.id === o.contact_id) || null,
        restaurant: db.restaurants.find(r => r.id === o.restaurant_id) || null,
      }))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  },
  async getOrder(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const o = db.orders.find(x => x.id === id && x.tenant_id === tenantId)
    if (!o) return null
    return {
      ...o,
      contact: db.contacts.find(c => c.id === o.contact_id) || null,
      restaurant: db.restaurants.find(r => r.id === o.restaurant_id) || null,
      items: db.order_items.filter(it => it.order_id === o.id),
      history: db.order_status_history
        .filter(h => h.order_id === o.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }
  },
  async updateOrderStatus(tenantId, id, newStatus, opts = {}) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const o = db.orders.find(x => x.id === id && x.tenant_id === tenantId)
    if (!o) throw new Error('Commande introuvable')
    if (!isAllowedOrderTransition(o.status, newStatus)) {
      throw new Error(`Transition interdite: ${o.status} → ${newStatus}`)
    }
    const fromStatus = o.status
    const ts = new Date().toISOString()
    o.status = newStatus
    o.updated_at = ts
    const actor = getActorForAudit()
    db.order_status_history.push({
      id: uid(),
      tenant_id: tenantId,
      order_id: o.id,
      from_status: fromStatus,
      to_status: newStatus,
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      reason: opts.reason || null,
      created_at: ts,
    })
    db.audit_logs.push({
      id: uid(),
      tenant_id: tenantId,
      event_type: 'order_status_changed',
      module_code: 'orders',
      tool_code: 'orders.update_status',
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      entity_type: 'order',
      entity_id: o.id,
      action: 'order.status_changed',
      success: true,
      correlation_id: o.correlation_id || null,
      reason: opts.reason || null,
      payload_summary: `${fromStatus} → ${newStatus}`,
      metadata: { from_status: fromStatus, to_status: newStatus, order_number: o.order_number },
      created_at: ts,
    })
    return o
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

const sb = {
  // ── Tenants
  async listTenants() {
    const { data, error } = await supabase.from('tenants').select('*').order('name')
    if (error) throw error
    return data
  },
  async getTenant(id) {
    const { data, error } = await supabase.from('tenants').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  },
  async updateTenant(id, patch) {
    const { data, error } = await supabase
      .from('tenants')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id).select('*').single()
    if (error) throw error
    return data
  },

  // Plan change (étape 1 — sans paiement). Update tenants.plan_id +
  // best-effort INSERT dans audit_logs. RLS doit autoriser l'owner à :
  //   - UPDATE tenants WHERE id = current_tenant
  //   - INSERT INTO audit_logs WHERE tenant_id = current_tenant
  // Si la policy d'INSERT audit_logs n'est pas accordée, on log un warn
  // mais on ne bloque pas le changement (l'audit sera complété par le
  // tool backend en étape 2).
  async updateTenantPlan(tenantId, planId, opts = {}) {
    if (!tenantId || !planId) throw new Error('tenantId et planId requis')

    const { data: tenant, error: e1 } = await supabase
      .from('tenants')
      .update({ plan_id: planId, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .select()
      .single()
    if (e1) throw e1

    try {
      const { error: e2 } = await supabase.from('audit_logs').insert({
        tenant_id:   tenantId,
        actor_type:  'user',
        actor_id:    opts.actorId ?? null,
        entity_type: 'tenant',
        entity_id:   tenantId,
        action:      'tenant.plan_changed',
        metadata: {
          from_plan_id:   opts.fromPlan?.id   ?? null,
          from_plan_code: opts.fromPlan?.code ?? null,
          to_plan_id:     opts.toPlan?.id     ?? planId,
          to_plan_code:   opts.toPlan?.code   ?? null,
          reason:         opts.reason ?? null,
        },
      })
      if (e2) throw e2
    } catch (auditErr) {
      // eslint-disable-next-line no-console
      console.warn('audit_logs insert failed (RLS ou schéma) :', auditErr)
    }

    return tenant
  },

  // ── Restaurants
  async listRestaurants(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase.from('restaurants').select('*').eq('tenant_id', tenantId).order('name')
    if (error) throw error
    return data
  },
  async getRestaurant(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase.from('restaurants').select('*').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
    if (error) throw error
    return data
  },
  async createRestaurant(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data: row, error } = await supabase.from('restaurants').insert({
      tenant_id: tenantId, name: data.name,
      restaurant_type: data.restaurant_type || 'restaurant',
      timezone: data.timezone || 'Africa/Abidjan',
      currency: data.currency || 'XOF',
      address: data.address || null,
      status: data.status || 'active',
    }).select('*').single()
    if (error) throw error
    return row
  },
  async updateRestaurant(tenantId, id, patch) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data: row, error } = await supabase
      .from('restaurants')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId).select('*').single()
    if (error) throw error
    return row
  },
  async deactivateRestaurant(tenantId, id) {
    return sb.updateRestaurant(tenantId, id, { status: 'inactive' })
  },

  // ── Tenant users
  async listTenantUsers(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase.from('tenant_users').select('*, user:users(*)').eq('tenant_id', tenantId).order('created_at')
    if (error) throw error
    return data
  },
  async createTenantUser(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data: result, error } = await supabase.functions.invoke('invite-user', {
      body: { tenant_id: tenantId, email: data.email, full_name: data.full_name || data.email.split('@')[0], role_code: data.role_code || 'staff' },
    })
    if (error) throw error
    if (result?.error) throw new Error(result.error)
    return result.member
  },

  // ── Restaurant users
  async listRestaurantUsers(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase.from('restaurant_users').select(`
      id, tenant_id, restaurant_id, user_id, role_code, status, created_at,
      user:users(id, email, full_name, status),
      restaurant:restaurants(id, name, restaurant_type, status)
    `).eq('tenant_id', tenantId).order('created_at')
    if (error) throw error
    return data
  },
  async createRestaurantUser(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    const VALID_ROLES = ['manager', 'staff', 'kitchen']
    const role_code = VALID_ROLES.includes(data.role_code) ? data.role_code : 'staff'
    const { data: row, error } = await supabase.from('restaurant_users').insert({
      tenant_id: tenantId, restaurant_id: data.restaurant_id, user_id: data.user_id, role_code, status: 'active',
    }).select(`id, tenant_id, restaurant_id, user_id, role_code, status, created_at, user:users(id, email, full_name, status), restaurant:restaurants(id, name, restaurant_type, status)`).single()
    if (error) throw error
    return row
  },
  async revokeRestaurantUser(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    const { error } = await supabase.from('restaurant_users').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw error
  },

  // ── Plans & entitlements
  async listPlans() {
    const { data, error } = await supabase.from('plans').select('*').order('name')
    if (error) throw error
    return data
  },
  async listEntitlements(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase.from('tenant_entitlements').select('*').eq('tenant_id', tenantId)
    if (error) throw error
    return data
  },
  async setEntitlement(tenantId, moduleCode, enabled) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase.rpc('upsert_entitlement', {
      p_tenant_id: tenantId, p_module_code: moduleCode, p_enabled: enabled,
    })
    if (error) throw error
    return data
  },
  async listPlanModules(planId) {
    if (!planId) throw new Error('planId requis')
    const { data, error } = await supabase.from('plan_modules').select('id, plan_id, module_code, included, created_at').eq('plan_id', planId).order('module_code')
    if (error) throw error
    return data
  },
  async syncTenantEntitlements(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase.rpc('sync_tenant_entitlements', { p_tenant_id: tenantId })
    if (error) throw error
    return data
  },

  // ── Channels
  async listChannels(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase.from('channels').select('*').eq('tenant_id', tenantId)
    if (error) throw error
    return data
  },

  // ── Audit logs
  async listAuditLogs(tenantId) {
    const query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
    if (tenantId) query.eq('tenant_id', tenantId)
    const { data, error } = await query
    if (error) throw error
    return data
  },

  // ── [C] Conversations ────────────────────────────────────────────────────
  async listConversations(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase
      .from('conversations')
      .select(`*, contact:contacts(id, full_name, first_name, last_name, email), channel:channels(id, channel_type, provider, external_channel_id)`)
      .eq('tenant_id', tenantId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    return data
  },
  async getConversation(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase
      .from('conversations')
      .select(`*, contact:contacts(id, full_name, first_name, last_name, email, language), channel:channels(id, channel_type, provider, external_channel_id)`)
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle()
    if (error) throw error
    return data
  },
  async listMessages(tenantId, conversationId) {
    if (!tenantId) throw new Error('tenantId requis')
    if (!conversationId) throw new Error('conversationId requis')
    const { data, error } = await supabase
      .from('messages').select('*')
      .eq('tenant_id', tenantId).eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  // ── [C] Contacts ─────────────────────────────────────────────────────────
  async listContacts(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase
      .from('contacts')
      .select(`*, channels:contact_channels(id, channel_type, channel_value, is_primary)`)
      .eq('tenant_id', tenantId).neq('status', 'merged')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data
  },
  async getContact(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase
      .from('contacts')
      .select(`*, channels:contact_channels(id, channel_type, channel_value, is_primary)`)
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle()
    if (error) throw error
    return data
  },
  async createContact(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data: contact, error } = await supabase.from('contacts').insert({
      tenant_id: tenantId,
      default_restaurant_id: data.default_restaurant_id || null,
      full_name: data.full_name || null, first_name: data.first_name || null,
      last_name: data.last_name || null, email: data.email || null,
      language: data.language || null, notes: data.notes || null, status: 'active',
    }).select().single()
    if (error) throw error
    if (data.channel_type && data.channel_value) {
      const { error: chErr } = await supabase.from('contact_channels').insert({
        tenant_id: tenantId, contact_id: contact.id,
        channel_type: data.channel_type, channel_value: data.channel_value, is_primary: true,
      })
      if (chErr) throw chErr
    }
    const actor = getActorForAudit()
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId, event_type: 'contact_created', module_code: 'contacts',
      tool_code: 'contacts.create', actor_type: actor.actor_type, actor_id: actor.actor_id,
      entity_type: 'contact', entity_id: contact.id, action: 'contact.created', success: true,
      payload_summary: `created contact ${contact.full_name || contact.email || contact.id}`,
      metadata: { has_channel: Boolean(data.channel_type) },
    })
    return contact
  },
  async updateContact(tenantId, id, patch) {
    if (!tenantId) throw new Error('tenantId requis')
    const ALLOWED = ['full_name', 'first_name', 'last_name', 'email', 'language', 'notes', 'status']
    const cleanPatch = {}
    for (const f of ALLOWED) if (f in patch) cleanPatch[f] = patch[f] ?? null
    if (Object.keys(cleanPatch).length === 0) throw new Error('Aucun champ à modifier')
    const { data: contact, error } = await supabase
      .from('contacts').update(cleanPatch).eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw error
    const actor = getActorForAudit()
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId, event_type: 'contact_profile_updated', module_code: 'contacts',
      tool_code: 'contacts.update_profile', actor_type: actor.actor_type, actor_id: actor.actor_id,
      entity_type: 'contact', entity_id: contact.id, action: 'contact.profile_updated', success: true,
      payload_summary: `updated fields: ${Object.keys(cleanPatch).join(', ')}`,
      metadata: { changed_fields: Object.keys(cleanPatch) },
    })
    return contact
  },

  // ── [C] Orders ───────────────────────────────────────────────────────────
  async listOrders(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase
      .from('orders')
      .select(`*, contact:contacts(id, full_name, first_name, last_name), restaurant:restaurants(id, name)`)
      .eq('tenant_id', tenantId).order('created_at', { ascending: false })
    if (error) throw error
    return data
  },
  async getOrder(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase
      .from('orders')
      .select(`*, contact:contacts(id, full_name, first_name, last_name, email), restaurant:restaurants(id, name, currency), items:order_items(*), history:order_status_history(*)`)
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle()
    if (error) throw error
    if (data?.history) data.history.sort((a, b) => a.created_at.localeCompare(b.created_at))
    return data
  },
  async updateOrderStatus(tenantId, id, newStatus, opts = {}) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data: current, error: e1 } = await supabase
      .from('orders').select('id, status, correlation_id, order_number')
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle()
    if (e1) throw e1
    if (!current) throw new Error('Commande introuvable')
    if (!isAllowedOrderTransition(current.status, newStatus)) {
      throw new Error(`Transition interdite: ${current.status} → ${newStatus}`)
    }
    const { data: updated, error: e2 } = await supabase
      .from('orders').update({ status: newStatus })
      .eq('id', id).eq('tenant_id', tenantId).eq('status', current.status)
      .select().single()
    if (e2) throw e2
    if (!updated) throw new Error('Mise à jour concurrente détectée — réessayez.')
    const actor = getActorForAudit()
    await supabase.from('order_status_history').insert({
      tenant_id: tenantId, order_id: id,
      from_status: current.status, to_status: newStatus,
      actor_type: actor.actor_type, actor_id: actor.actor_id, reason: opts.reason || null,
    })
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId, event_type: 'order_status_changed', module_code: 'orders',
      tool_code: 'orders.update_status', actor_type: actor.actor_type, actor_id: actor.actor_id,
      entity_type: 'order', entity_id: id, action: 'order.status_changed', success: true,
      correlation_id: current.correlation_id || null, reason: opts.reason || null,
      payload_summary: `${current.status} → ${newStatus}`,
      metadata: { from_status: current.status, to_status: newStatus, order_number: current.order_number },
    })
    return updated
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT — single object used by the rest of the app
// ─────────────────────────────────────────────────────────────────────────────

export const api = SOURCE === 'supabase'
  ? new Proxy(sb, {
      get(target, prop) {
        if (typeof target[prop] !== 'function') {
          return () => { throw new Error(`api.${String(prop)} non implémenté côté Supabase`) }
        }
        return target[prop].bind(target)
      },
    })
  : mock
