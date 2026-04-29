/**
 * Status literal unions and allowed transitions per module.
 *
 * The values mirror the CHECK constraints currently in the DB
 * (see migrations 004–007). Any change here must be paired with a SQL
 * migration that updates the CHECK and back-fills existing rows.
 *
 * Transitions are pairs `[from, to]`. We deliberately use a flat array of
 * tuples rather than `Record<from, to[]>` so the literal types survive into
 * runtime checks (validateTransition typechecks both ends).
 */

// ── Modules ────────────────────────────────────────────────────────────────
export const MODULE_CODES = [
  'contacts',
  'menus',
  'orders',
  'reservations',
  'catering',
  'healthy',
  'handoff',
] as const;
export type ModuleCode = (typeof MODULE_CODES)[number];

// ── Orders ─────────────────────────────────────────────────────────────────
export const ORDER_STATUSES = [
  'draft',
  'awaiting_confirmation',
  'confirmed',
  'in_preparation',
  'ready',
  'delivered',
  'cancelled',
  'closed',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: ReadonlyArray<readonly [OrderStatus, OrderStatus]> = [
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
];

// ── Reservations ───────────────────────────────────────────────────────────
export const RESERVATION_STATUSES = [
  'pending',
  'confirmed',
  'seated',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_TRANSITIONS: ReadonlyArray<
  readonly [ReservationStatus, ReservationStatus]
> = [
  ['pending', 'confirmed'],
  ['pending', 'cancelled'],
  ['confirmed', 'seated'],
  ['confirmed', 'cancelled'],
  ['confirmed', 'no_show'],
  ['seated', 'completed'],
];

// ── Catering ───────────────────────────────────────────────────────────────
export const CATERING_STATUSES = [
  'lead',
  'qualified',
  'quoted',
  'confirmed',
  'in_preparation',
  'completed',
  'cancelled',
] as const;
export type CateringStatus = (typeof CATERING_STATUSES)[number];

export const CATERING_TRANSITIONS: ReadonlyArray<
  readonly [CateringStatus, CateringStatus]
> = [
  ['lead', 'qualified'],
  ['lead', 'cancelled'],
  ['qualified', 'quoted'],
  ['qualified', 'cancelled'],
  ['quoted', 'confirmed'],
  ['quoted', 'cancelled'],
  ['confirmed', 'in_preparation'],
  ['confirmed', 'cancelled'],
  ['in_preparation', 'completed'],
  ['in_preparation', 'cancelled'],
];

// ── Healthy subscriptions ──────────────────────────────────────────────────
export const HEALTHY_STATUSES = [
  'lead',
  'pending_validation',
  'active',
  'paused',
  'completed',
  'cancelled',
] as const;
export type HealthyStatus = (typeof HEALTHY_STATUSES)[number];

export const HEALTHY_TRANSITIONS: ReadonlyArray<
  readonly [HealthyStatus, HealthyStatus]
> = [
  ['lead', 'pending_validation'],
  ['lead', 'cancelled'],
  ['pending_validation', 'active'],
  ['pending_validation', 'cancelled'],
  ['active', 'paused'],
  ['active', 'completed'],
  ['active', 'cancelled'],
  ['paused', 'active'],
  ['paused', 'cancelled'],
];

// ── Service types (orders) ─────────────────────────────────────────────────
export const SERVICE_TYPES = ['delivery', 'pickup', 'dine_in'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

// ── Channel types ──────────────────────────────────────────────────────────
export const CHANNEL_TYPES = ['whatsapp', 'telegram', 'sms', 'email', 'webchat'] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];
