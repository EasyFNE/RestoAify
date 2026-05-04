// src/pages/tenant/BillingPage.jsx
//
// Page « Abonnement & Facturation » côté tenant.
//
// Étape 1 (actuelle) — changement de plan libre, sans paiement.
//   - Owner uniquement (cf. doc 07-security-access.md §2.3 « Tenant Owner »)
//   - Confirmation + raison → tracé dans audit_logs
//   - Placeholder pour la section factures/paiements
//
// Étape 2 (à venir) — intégration prestataire de paiement (Stripe ou
// alternative XOF/CI), facturation, factures téléchargeables, validation
// du paiement avant application du changement.
//
// Multi-tenant (cf. doc 01) : currentTenantId obligatoire, tous les appels
// passent par api.* qui propage le contexte tenant. RLS côté Supabase fait
// le reste.
import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Button from '../../components/Button.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'
import { useAuth } from '../../hooks/useAuth.js'
import { PLAN_DISPLAY, formatXOF } from '../../config/billing.js'

// Owner-only gate.
//
// Note d'historique : la doc 07 mentionne `tenant_owner` comme valeur
// canonique, mais la CHECK constraint réelle (migration 011) et le seed
// utilisent `owner` (cf. UsersPage.jsx). On accepte les deux pour rester
// défensif tant que la cohérence doc/DB n'est pas pleinement réconciliée.
// Les Platform Admins peuvent aussi changer le plan (impersonation/support).
function canChangePlan(user) {
  if (!user) return false
  if (user.scope === 'platform') return true
  return user.role === 'tenant_owner' || user.role === 'owner'
}

export default function BillingPage() {
  const { currentTenantId } = useTenant()
  const { currentUser } = useAuth()
  const [plans, setPlans] = useState([])
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingPlan, setPendingPlan] = useState(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState(null)
  const [success, setSuccess] = useState(null)

  const isOwner = useMemo(() => canChangePlan(currentUser), [currentUser])

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    async function load() {
      const [pp, t] = await Promise.all([
        api.listPlans(),
        api.getTenant(currentTenantId),
      ])
      if (cancelled) return
      setPlans(pp)
      setTenant(t)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [currentTenantId])

  const currentPlan = plans.find(p => p.id === tenant?.plan_id) || null

  function openConfirm(plan) {
    setModalError(null)
    setSuccess(null)
    setReason('')
    setPendingPlan(plan)
  }

  function closeConfirm() {
    if (submitting) return
    setPendingPlan(null)
    setReason('')
    setModalError(null)
  }

  async function handleConfirm() {
    if (!pendingPlan || !currentTenantId) return
    if (reason.trim().length < 3) {
      setModalError("Merci d'indiquer une raison (3 caractères minimum).")
      return
    }
    setSubmitting(true)
    setModalError(null)
    try {
      const updated = await api.updateTenantPlan(currentTenantId, pendingPlan.id, {
        reason: reason.trim(),
        actorId: currentUser?.id ?? null,
        fromPlan: currentPlan ? { id: currentPlan.id, code: currentPlan.code } : null,
        toPlan: { id: pendingPlan.id, code: pendingPlan.code },
      })
      setTenant(updated)
      setSuccess(`Plan mis à jour : « ${pendingPlan.name} ».`)
      setPendingPlan(null)
      setReason('')
    } catch (err) {
      setModalError(err?.message || 'Erreur lors du changement de plan.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm">Chargement…</div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Abonnement & Facturation"
        description="Gérez votre plan SaaS. Les paiements seront activés dans une prochaine version."
      />

      {/* Bandeau v1 */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
        <span className="text-base">⚠️</span>
        <span>
          <strong>Mode v1 — sans paiement.</strong> Le changement de plan est libre et immédiat.
          L'intégration d'un prestataire de paiement (Stripe / Wave / Orange Money) est planifiée
          pour la prochaine itération.
        </span>
      </div>

      {/* Succès */}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✓ {success}
        </div>
      )}

      {/* ── Bloc 1 : Plan actuel ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Plan actuel</h2>
        {currentPlan ? (
          <div className="card p-5 flex flex-col gap-2 border-2 border-brand-500">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800 uppercase tracking-wide">
                {currentPlan.code}
              </span>
              <span className="font-semibold text-gray-900">{currentPlan.name}</span>
              <StatusBadge status={tenant?.status || 'active'} />
            </div>
            {PLAN_DISPLAY[currentPlan.code] && (
              <p className="text-sm text-gray-500">{PLAN_DISPLAY[currentPlan.code].tagline}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Tenant ID : <code className="font-mono">{currentTenantId}</code>
            </p>
          </div>
        ) : (
          <div className="card p-5 text-sm text-gray-500">Aucun plan associé à ce tenant.</div>
        )}
      </section>

      {/* ── Bloc 2 : Changer de plan ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Changer de plan</h2>
        {!isOwner && (
          <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-500 mb-4">
            Seul le propriétaire du tenant peut modifier le plan.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map(p => {
            const meta = PLAN_DISPLAY[p.code]
            const isCurrent = p.id === currentPlan?.id
            return (
              <div
                key={p.id}
                className={`card p-5 flex flex-col gap-3 ${
                  isCurrent ? 'border-2 border-brand-400 bg-brand-50' : 'border border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 uppercase">
                      {p.code}
                    </span>
                    <span className="font-semibold text-gray-900">{p.name}</span>
                  </div>
                  {isCurrent && (
                    <span className="text-xs font-medium text-brand-600 bg-brand-50 border border-brand-200 rounded px-2 py-0.5">
                      Actuel
                    </span>
                  )}
                </div>

                {meta && (
                  <>
                    <p className="text-sm text-gray-500">{meta.tagline}</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatXOF(meta.priceXof)}
                      <span className="text-sm font-normal text-gray-400"> / mois</span>
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {meta.features.map(f => (
                        <li key={f} className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <Button
                  className="w-full mt-auto"
                  variant={isCurrent ? 'secondary' : 'primary'}
                  disabled={isCurrent || !isOwner}
                  onClick={() => openConfirm(p)}
                >
                  {isCurrent ? 'Plan en cours' : `Passer à ${p.name}`}
                </Button>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Bloc 3 : Factures placeholder ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Factures & paiements</h2>
        <div className="card p-6 text-center text-sm text-gray-500 border border-dashed border-gray-300">
          <p className="mb-1 font-medium text-gray-700">Non disponible en v1</p>
          <p>
            La gestion des factures et l'intégration d'un prestataire de paiement
            (Stripe ou alternative XOF) seront ajoutées dans une prochaine itération.
            Pour l'instant, le changement de plan est libre et instantané.
          </p>
        </div>
      </section>

      {/* ── Modale de confirmation ── */}
      {pendingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Confirmer le changement de plan</h3>
            <p className="text-sm text-gray-600">
              Vous allez passer du plan{' '}
              <strong>{currentPlan?.name || 'aucun'}</strong> au plan{' '}
              <strong>{pendingPlan.name}</strong>.
            </p>
            <p className="text-sm text-gray-600">
              Cette action sera tracée dans l'audit avec la raison fournie ci-dessous.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Raison <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="Ex : passage en mode test, upgrade commercial…"
                value={reason}
                onChange={e => setReason(e.target.value)}
                autoFocus
              />
            </div>

            {modalError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {modalError}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={closeConfirm} disabled={submitting}>
                Annuler
              </Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                {submitting ? 'Application…' : 'Confirmer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
