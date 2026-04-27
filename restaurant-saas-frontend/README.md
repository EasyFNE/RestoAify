# Restaurant SaaS — Backoffice (v1)

Interface admin minimaliste pour la plateforme SaaS multi-tenant restaurants.
Architecture pensée pour livrer vite et ajouter les modules métier (Orders,
Reservations, Catering, Healthy, WhatsApp) sans refonte.

## Stack

- React 18
- Vite 5
- React Router 6
- Tailwind CSS
- Supabase JS (branchable plus tard)

## Démarrer

```bash
npm install
cp .env.example .env
npm run dev
```

L'app tourne par défaut sur http://localhost:5173 avec des données mockées
(`VITE_DATA_SOURCE=mock`). Pas besoin de backend pour démarrer.

## Auth de démo

L'écran de login accepte n'importe quel email :

- email contenant `platform` → connexion comme **Platform Admin**
- tout autre email → connexion comme **Tenant Admin** (rattaché au tenant
  mocké "Le Spot")

Le mot de passe n'est pas vérifié en mode mock.

## Build & déploiement Hostinger

```bash
npm run build
```

Génère `dist/` (HTML + CSS + JS statiques).
Upload du contenu de `dist/` dans `public_html/` via le File Manager Hostinger
ou FTP. Aucun Node.js requis côté serveur.

> Important : si déploiement dans un sous-dossier (ex. `public_html/admin/`),
> `vite.config.js` est déjà en `base: './'` donc ça marche tel quel.

## Brancher Supabase plus tard

1. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `.env`
2. Passer `VITE_DATA_SOURCE=supabase`
3. Implémenter les méthodes Supabase dans `src/services/api.js`
   (les signatures sont déjà prêtes)
4. Côté DB : appeler `SET app.current_tenant = '<uuid>'` au début de chaque
   session pour activer la RLS — voir doc projet `01-multi-tenant-architecture.md`

## Architecture

- `src/config/menu.js` — source unique de vérité pour la sidebar.
  Statut par item : `active | reserved | hidden`.
- `src/config/modules.js` — registre des modules métier.
- `src/router/index.jsx` — table de routes centralisée.
- `src/services/api.js` — façade unique mock/Supabase.
- `src/contexts/` — Auth + Tenant courant.

## Activer un module réservé (futur)

Exemple pour Orders :

1. Dans `src/config/menu.js`, passer l'item `orders` de `reserved` à `active`
2. Créer `src/pages/tenant/OrdersPage.jsx`
3. Dans `src/router/index.jsx`, remplacer `<ComingSoonPage />` par `<OrdersPage />`
4. Implémenter les services dans `src/services/api.js`
5. Côté DB : créer les tables conformes au doc `02-data-model.md` + RLS

Aucun changement au shell, layouts, ou autres pages.

## Multi-tenant — règles non négociables

Le code applique strictement les principes des docs 01/07 :

- **Tenant context obligatoire** : tous les appels services prennent `tenantId`
  en argument explicite (jamais déduit silencieusement).
- **Séparation Platform / Tenant** : routes `/platform/*` vs `/app/*`,
  contextes distincts, navigation distincte.
- **Pas de RLS bypass** : aucun service mock ne triche en accédant à des
  données d'autres tenants ; même comportement attendu côté Supabase.
- **Audit prêt** : `audit_logs` est listé dans le menu et la table mockée
  conforme au modèle.

## Convention de nommage

Aligné sur `02-data-model.md` :

- `restaurants` (et non `sites`)
- `restaurant_users` (et non `site_users`)
- `contacts` (clients finaux), `tenant_users` (staff)
- `tenant_entitlements` pour les modules activés
