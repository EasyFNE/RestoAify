export default function EmptyState({ title = 'Aucun élément', message, action }) {
  return (
    <div className="p-10 text-center">
      <div className="text-gray-900 font-medium">{title}</div>
      {message && <div className="text-sm text-gray-500 mt-1">{message}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
