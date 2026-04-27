import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import Button from '../components/Button.jsx'
import FormField from '../components/FormField.jsx'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const user = await signIn({ email, password })
      navigate(user.scope === 'platform' ? '/platform' : '/app', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <div className="text-center mb-6">
        <div className="w-10 h-10 rounded-md bg-brand-600 text-white flex items-center justify-center font-bold mx-auto">R</div>
        <h1 className="mt-3 text-lg font-semibold text-gray-900">Restaurant SaaS</h1>
        <p className="text-xs text-gray-500 mt-1">Backoffice</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="vous@exemple.com"
          helpText="Astuce : un email contenant 'platform' connecte en Platform Admin."
        />
        <FormField
          label="Mot de passe"
          name="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          placeholder="••••••••"
        />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>

      <p className="text-[11px] text-gray-400 text-center mt-6">
        Mode démo · authentification mockée
      </p>
    </div>
  )
}
