// src/config/billing.js
//
// Métadonnées d'affichage HARDCODÉES côté front pour les plans SaaS.
//
// Le canon des plans vit dans la table `plans` (cf. doc 02-data-model.md
// §2.4) avec les champs minimaux : id, code, name, status. Cette table
// n'a pas de prix ni de features en v1 — on les expose ici uniquement
// pour l'affichage de la page Billing.
//
// Quand on étendra `plans` (price_amount, currency, features jsonb, etc.),
// ce fichier deviendra obsolète ou se réduira à des fallbacks d'affichage.
//
// IMPORTANT : la facturation n'est PAS active en v1. Les prix ci-dessous
// sont indicatifs ; aucun paiement n'est prélevé. L'intégration d'un
// prestataire (Stripe ou alternative XOF/CI) viendra dans une prochaine
// itération.

export const PLAN_DISPLAY = {
  starter: {
    tagline: "Pour démarrer un restaurant ou un dark kitchen avec les fonctionnalités essentielles.",
    priceXof: 25000,
    features: [
      "1 restaurant",
      "WhatsApp Cloud API (1 numéro)",
      "Modules Orders & Reservations",
      "Jusqu'à 1 000 conversations / mois",
      "Audit & journal d'activité",
      "Support email standard",
    ],
  },
  pro: {
    tagline: "Pour les groupes et marques avec plusieurs restaurants et besoins étendus.",
    priceXof: 75000,
    features: [
      "Restaurants illimités",
      "WhatsApp Cloud API (multi-numéros)",
      "Tous les modules : Orders, Reservations, Catering, Healthy",
      "Conversations illimitées",
      "Audit & RBAC avancé",
      "Support prioritaire",
    ],
  },
}

// Formate un montant XOF (FCFA) en chaîne « 25 000 FCFA ».
// XOF n'a pas de subdivision (pas de centimes) : on reçoit déjà des
// francs entiers. Si tu adoptes plus tard la convention « base units »
// (centimes pour XOF, comme dans orders.subtotal_amount — cf. 02 §5.1),
// il faudra diviser ici par 100.
export function formatXOF(amount) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(amount)
}
