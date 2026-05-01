import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient.js'
import FormField from '../components/FormField.jsx'
import Button from '../components/Button.jsx'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [fullName, setFullName]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg]   = useState('')
  const [success, setSuccess]     = useState(false)

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

    setSubmitting(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })
      if (error) {
        setErrorMsg(error.message)
        return
      }
      setSuccess(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <div className="text-center mb-6">
        <div className="w-10 h-10 rounded-md bg-brand-600 text-white flex items-center justify-center font-bold mx-auto">R</div>
        <h1 className="mt-3 text-lg font-semibold text-gray-900">Créer un compte</h1>
        <p className="text-xs text-gray-500 mt-1">Restaurant SaaS · Backoffice</p>
      </div>

      {success ? (
        <div className="text-center space-y-3">
          <div className="text-green-600 text-4xl">✓</div>
          <p className="text-sm font-medium text-gray-800">Vérifiez votre email !</p>
          <p className="text-xs text-gray-500">
            Un lien de confirmation a été envoyé à <strong>{email}</strong>.
            Cliquez dessus pour activer votre compte.
          </p>
          <Link to="/login" className="btn-primary block w-full text-center mt-4">
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <FormField
            label="Nom complet"
            name="fullName"
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
            placeholder="Jean Dupont"
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="vous@exemple.com"
          />
          <FormField
            label="Mot de passe"
            name="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="8 caractères minimum"
          />
          <FormField
            label="Confirmer le mot de passe"
            name="confirm"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            placeholder="Répétez le mot de passe"
          />

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Création…' : 'Créer mon compte'}
          </Button>

          <p className="text-center text-xs text-gray-500 mt-2">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-brand-600 hover:underline font-medium">
              Se connecter
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}
