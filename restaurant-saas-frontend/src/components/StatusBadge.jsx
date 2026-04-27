import { cn } from '../lib/cn.js'

// Central color map for statuses encountered in the project.
// Aligned with 06-lifecycle-status.md (kept loose; unknown statuses fall back to gray).
const COLORS = {
  active:        'bg-green-100 text-green-700',
  inactive:      'bg-gray-100 text-gray-600',
  draft:         'bg-blue-100 text-blue-700',
  pending:       'bg-amber-100 text-amber-700',
  suspended:     'bg-red-100 text-red-700',
  archived:      'bg-gray-200 text-gray-600',
  enabled:       'bg-green-100 text-green-700',
  disabled:      'bg-gray-100 text-gray-600',
}

export default function StatusBadge({ status, className }) {
  const cls = COLORS[status] || 'bg-gray-100 text-gray-600'
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        cls,
        className,
      )}
    >
      {status || '—'}
    </span>
  )
}
