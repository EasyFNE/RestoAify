import { Component } from 'react'

/**
 * ErrorBoundary global — attrape les erreurs React non gérées
 * et affiche un message lisible au lieu d'une page blanche.
 *
 * Wrappé autour du router dans main.jsx.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Erreur non gérée :', error, info.componentStack)
  }

  handleReset() {
    this.setState({ hasError: false, error: null })
    window.location.href = '/app'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full bg-white rounded-xl border border-red-200 shadow-sm p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Une erreur est survenue</h2>
            <p className="text-sm text-gray-500 mb-1">Le composant a planté de façon inattendue.</p>
            {this.state.error?.message && (
              <p className="text-xs text-red-500 bg-red-50 rounded p-2 mt-3 text-left font-mono break-words">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => this.handleReset()}
              className="mt-6 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Retour au dashboard
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
