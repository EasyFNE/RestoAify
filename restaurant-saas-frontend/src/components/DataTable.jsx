import { useMemo, useState } from 'react'
import EmptyState from './EmptyState.jsx'

/**
 * Simple data table.
 *
 * Props:
 *   columns: [{ key, header, render?: (row) => node, className? }]
 *   data:    [object]
 *   loading: bool
 *   error:   string|null
 *   onRowClick: (row) => void
 *   searchable: bool (filters across all stringifiable values)
 *   emptyTitle, emptyMessage, emptyAction
 */
export default function DataTable({
  columns,
  data = [],
  loading = false,
  error = null,
  onRowClick,
  searchable = true,
  emptyTitle = 'Aucun élément',
  emptyMessage,
  emptyAction,
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    if (!q.trim()) return data
    const needle = q.toLowerCase()
    return data.filter(row =>
      Object.values(row).some(v =>
        v != null && String(v).toLowerCase().includes(needle),
      ),
    )
  }, [data, q])

  if (loading) {
    return <div className="card p-6 text-center text-gray-500">Chargement…</div>
  }

  if (error) {
    return (
      <div className="card p-6 text-center text-red-600 border-red-200">
        Erreur : {error}
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {searchable && (
        <div className="p-3 border-b border-gray-200">
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="input max-w-xs"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map(col => (
                <th key={col.key} className={col.className || 'table-th'}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((row, idx) => (
              <tr
                key={row.id || idx}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'hover:bg-gray-50 cursor-pointer' : ''}
              >
                {columns.map(col => (
                  <td key={col.key} className="table-td">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
