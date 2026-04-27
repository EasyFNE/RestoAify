import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="card p-10 text-center max-w-md">
        <div className="text-3xl font-semibold text-gray-900">404</div>
        <p className="text-sm text-gray-600 mt-2">
          Page introuvable.
        </p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}
