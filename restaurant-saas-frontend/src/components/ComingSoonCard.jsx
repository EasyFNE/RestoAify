export default function ComingSoonCard({ title, description }) {
  return (
    <div className="card p-10 text-center max-w-2xl mx-auto">
      <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 mb-4">
        Bientôt disponible
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {description && (
        <p className="text-sm text-gray-600 mt-2">{description}</p>
      )}
      <p className="text-xs text-gray-500 mt-6">
        Ce module est prévu dans la roadmap mais n'est pas encore implémenté
        dans cette version. La route et la place dans la navigation existent
        déjà — l'activation se fera sans refonte.
      </p>
    </div>
  )
}
