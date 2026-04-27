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

// ─────────────────────────────────────────────────────────────────────────
// MOCK IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────

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

  // ── Tenant users (staff)
  async listTenantUsers(tenantId) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    const memberships = db.tenant_users.filter(tu => tu.tenant_id === tenantId)
    // Join with users table for display
    return memberships.map(m => ({
      ...m,
      user: db.users.find(u => u.id === m.user_id) || null,
    }))
  },
  async createTenantUser(tenantId, data) {
    if (!tenantId) throw new Error('tenantId requis')
    await sleep()
    // 1. find or create the underlying user (global table)
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
    // 2. link to tenant
    const link = {
      id: uid(),
      tenant_id: tenantId,
      user_id: user.id,
      role_code: data.role_code || 'staff',
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
    return [...db.audit_logs] // platform scope (caller must have rights)
  },
}

// ─────────────────────────────────────────────────────────────────────────
// SUPABASE IMPLEMENTATION (stubs — to be fleshed out when backend ready)
// ─────────────────────────────────────────────────────────────────────────

const sb = {
  async listTenants() {
    const { data, error } = await supabase.from('tenants').select('*').order('name')
    if (error) throw error
    return data
  },
  async getTenant(id) {
    const { data, error } = await supabase.from('tenants').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  // TODO: implement remaining methods. Always pass tenantId in `.eq('tenant_id', tenantId)`
  // and rely on RLS for defense in depth.
}

// ─────────────────────────────────────────────────────────────────────────
// EXPORT — single object used by the rest of the app
// ─────────────────────────────────────────────────────────────────────────

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
