/**
 * DB row shapes — narrow types for what the backend reads/writes.
 * Hand-written, keyed to the production schema as of migrations 001–012.
 *
 * Why not auto-generate from Supabase types?
 *  - Supabase's generated types include all PostgREST views/RPCs and bring
 *    a lot of noise. We only need the tables tools touch, with strict
 *    typing on enums (statuses, channel_type, etc.) — see types/statuses.
 *  - Updates to this file are intentional and reviewed.
 */

import type {
  CateringStatus,
  ChannelType,
  HealthyStatus,
  OrderStatus,
  ReservationStatus,
  ServiceType,
} from './statuses.js';

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'cancelled' | 'trial';
  plan_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestaurantRow {
  id: string;
  tenant_id: string;
  name: string;
  restaurant_type: 'restaurant' | 'dark_kitchen' | 'lab' | 'venue' | 'other';
  timezone: string;
  currency: string; // ISO 4217, 3 chars
  address: string | null;
  status: 'active' | 'inactive' | 'suspended' | 'archived';
}

export interface ContactRow {
  id: string;
  tenant_id: string;
  default_restaurant_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  language: string | null;
  notes: string | null;
  status: 'active' | 'merged' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface ContactChannelRow {
  id: string;
  tenant_id: string;
  contact_id: string;
  channel_type: ChannelType;
  channel_value: string;
  is_primary: boolean;
}

export interface ConversationRow {
  id: string;
  tenant_id: string;
  restaurant_id: string | null;
  contact_id: string;
  channel_id: string;
  status: string;
  current_context_type: 'order' | 'reservation' | 'catering' | 'healthy' | null;
  current_context_id: string | null;
}

export interface OrderRow {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  contact_id: string;
  conversation_id: string | null;
  correlation_id: string;
  order_number: string | null;
  service_type: ServiceType;
  status: OrderStatus;
  subtotal_amount: number;
  total_amount: number;
  items_count: number;
  currency: string;
  requested_for: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  tenant_id: string;
  order_id: string;
  menu_item_id: string | null;
  menu_item_variant_id: string | null;
  qty: number;
  unit_price: number;
  total_price: number;
  line_total: number;
  selected_option_ids: string[];
  special_instructions: string | null;
  item_name_snapshot: string | null;
  selected_options_snapshot: unknown | null;
}

export interface ReservationRow {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  contact_id: string;
  conversation_id: string | null;
  correlation_id: string | null;
  reservation_number: string;
  reservation_date: string; // YYYY-MM-DD
  reservation_time: string; // HH:MM:SS
  party_size: number;
  status: ReservationStatus;
  area_preference: string | null;
  special_requests: string | null;
}

export interface ReservationSlotRow {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  slot_date: string;
  slot_time: string;
  capacity_total: number;
  capacity_reserved: number;
  status: 'open' | 'closed' | 'blocked';
}

export interface CateringRequestRow {
  id: string;
  tenant_id: string;
  restaurant_id: string | null;
  contact_id: string;
  conversation_id: string | null;
  request_number: string;
  status: CateringStatus;
}

export interface HealthySubscriptionRow {
  id: string;
  tenant_id: string;
  restaurant_id: string | null;
  contact_id: string;
  conversation_id: string | null;
  subscription_number: string;
  status: HealthyStatus;
}

export interface MenuItemRow {
  id: string;
  tenant_id: string;
  restaurant_id: string | null;
  name: string;
  description: string | null;
  base_price: number;
  currency: string;
  category: string | null;
  status: 'active' | 'unavailable' | 'archived';
}
