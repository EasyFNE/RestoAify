import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient.js'

export default function SetPasswordPage() {
  const navigate = useNavigate()

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [status, setStatus]       = useState('idle') // idle | loading | success | error | invalid
  const [errorMsg, setErrorMsg]   = useState('')

  // Supabase envoie le token dans le hash de l'URL : #access_token=...&type=invite
  // On le laisse gérer par onAuthStateChange, mais on vérifie que la session existe.
  useEffect(() => {
    // Si l'URL contient un token d'invitation, Supabase le traite automatiquement.
    // On vérifie juste qu'on a bien une session active après le hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        // session active — on peut afficher le formulaire
        setStatus('idle')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg('')

    if (password.length < 8) {
      setErrorMsg('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setErrorMsg('Les mots de passe ne correspondent pas.')
      return
    }

    setStatus('loading')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
      return
    }
    setStatus('success')
    setTimeout(() => navigate('/'), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / titre */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">RestoAify</h1>
          <p className="text-sm text-gray-500 mt-1">Définir votre mot de passe</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          {status === 'success' ? (
            <div className="text-center">
              <div className="text-green-600 text-4xl mb-3">✓</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Mot de passe défini !</h2>
              <p className="text-sm text-gray-500">Vous allez être redirigé vers l'application…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Bienvenue ! Choisissez un mot de passe pour activer votre compte.
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  className="input"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="input"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="btn-primary w-full"
              >
                {status === 'loading' ? 'Enregistrement…' : 'Définir mon mot de passe'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Un problème ? Contactez votre administrateur.
        </p>
      </div>
    </div>
  )
}
