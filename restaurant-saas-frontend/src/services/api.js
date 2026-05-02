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

// ───────────────────────────────────────────────────────────────────────────
// MOCK IMPLEMENTATION
// ───────────────────────────────────────────────────────────────────────────

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
      e.updated_at = new Date().toISOString()
      e.source = 'admin'
    } else {
      e = {
        id: uid(),
        tenant_id: tenantId,
        module_code: moduleCode,
        feature_code: null,
        enabled,
        source: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      db.tenant_entitlements.push(e)
    }
    return e
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
}

// ───────────────────────────────────────────────────────────────────────────
// SUPABASE IMPLEMENTATION
// ───────────────────────────────────────────────────────────────────────────

const sb = {
  // ── Tenants
  async listTenants() {
    const { data, error } = await supabase.from('tenants').select('*').order('name')
    if (error) throw error
    return data
  },
  async getTenant(id) {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  // ── Restaurants
  async listRestaurants(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    if (error) throw error
    return data
  },
  async getRestaurant(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error) throw error
    return data
  },
  async createRestaurant(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data: row, error } = await supabase
      .from('restaurants')
      .insert({
        tenant_id:       tenantId,
        name:            data.name,
        restaurant_type: data.restaurant_type || 'restaurant',
        timezone:        data.timezone || 'Africa/Abidjan',
        currency:        data.currency || 'XOF',
        address:         data.address || null,
        status:          data.status || 'active',
      })
      .select('*')
      .single()
    if (error) throw error
    return row
  },
  async updateRestaurant(tenantId, id, patch) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data: row, error } = await supabase
      .from('restaurants')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single()
    if (error) throw error
    return row
  },
  async deactivateRestaurant(tenantId, id) {
    return sb.updateRestaurant(tenantId, id, { status: 'inactive' })
  },

  // ── Tenant users
  async listTenantUsers(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase
      .from('tenant_users')
      .select('*, user:users(*)')
      .eq('tenant_id', tenantId)
      .order('created_at')
    if (error) throw error
    return data
  },

  // Inviter via Edge Function sécurisée
  // Crée dans auth.users + public.users + tenant_users
  // L'utilisateur reçoit un email pour définir son mot de passe
  async createTenantUser(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data: result, error } = await supabase.functions.invoke('invite-user', {
      body: {
        tenant_id: tenantId,
        email:     data.email,
        full_name: data.full_name || data.email.split('@')[0],
        role_code: data.role_code || 'staff',
      },
    })
    if (error) throw error
    if (result?.error) throw new Error(result.error)
    return result.member
  },

  // ── Restaurant users (per-restaurant access)
  async listRestaurantUsers(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase
      .from('restaurant_users')
      .select(`
        id,
        tenant_id,
        restaurant_id,
        user_id,
        role_code,
        status,
        created_at,
        user:users(id, email, full_name, status),
        restaurant:restaurants(id, name, restaurant_type, status)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at')
    if (error) throw error
    return data
  },
  async createRestaurantUser(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    const VALID_ROLES = ['manager', 'staff', 'kitchen']
    const role_code = VALID_ROLES.includes(data.role_code) ? data.role_code : 'staff'
    const { data: row, error } = await supabase
      .from('restaurant_users')
      .insert({
        tenant_id:     tenantId,
        restaurant_id: data.restaurant_id,
        user_id:       data.user_id,
        role_code,
        status:        'active',
      })
      .select(`
        id,
        tenant_id,
        restaurant_id,
        user_id,
        role_code,
        status,
        created_at,
        user:users(id, email, full_name, status),
        restaurant:restaurants(id, name, restaurant_type, status)
      `)
      .single()
    if (error) throw error
    return row
  },
  async revokeRestaurantUser(tenantId, id) {
    if (!tenantId) throw new Error('tenantId requis')
    const { error } = await supabase
      .from('restaurant_users')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
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
    const { data, error } = await supabase
      .from('tenant_entitlements')
      .select('*')
      .eq('tenant_id', tenantId)
    if (error) throw error
    return data
  },

  // ── Channels
  async listChannels(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('tenant_id', tenantId)
    if (error) throw error
    return data
  },

  // ── Audit logs
  async listAuditLogs(tenantId) {
    const query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (tenantId) query.eq('tenant_id', tenantId)
    const { data, error } = await query
    if (error) throw error
    return data
  },
}

// ───────────────────────────────────────────────────────────────────────────
// EXPORT — single object used by the rest of the app
// ───────────────────────────────────────────────────────────────────────────

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
