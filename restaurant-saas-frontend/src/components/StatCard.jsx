export default function StatCard({ label, value, hint }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  )
}
