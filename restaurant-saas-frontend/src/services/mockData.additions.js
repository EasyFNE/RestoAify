// =============================================================================
// mockData.js — ADDITIONS for Operations modules
// =============================================================================
// HOW TO INTEGRATE
//
// Open `src/services/mockData.js` and:
// 1. Paste section [A] constants near the top.
// 2. Add the 7 arrays from section [B] inside the `seed = { ... }` object.
//
// Realistic seed for Abidjan / Côte d'Ivoire. All amounts in base XOF units.
// =============================================================================

// [A] CONSTANTS
const CONTACT_AICHA = 'cont-1'
const CONTACT_KOUAME = 'cont-2'
const CONTACT_FATOU = 'cont-3'
const CONTACT_YAO = 'cont-4'
const CONV_AICHA_ORDER = 'cv-1'
const CONV_KOUAME_INFO = 'cv-2'
const CONV_FATOU_HANDOFF = 'cv-3'
const ORDER_AICHA_DRAFT = 'ord-1'
const ORDER_KOUAME_DELIVERED = 'ord-2'
const ORDER_FATOU_PREP = 'ord-3'
const ORDER_YAO_CANCELLED = 'ord-4'

// [B] SEED — paste inside seed = { ... }
// contacts, contact_channels, conversations, messages,
// orders, order_items, order_status_history
// (see full arrays in mockData.additions-8.js attached)
