import Button from './Button.jsx'

export default function ConfirmModal({
  open,
  title = 'Confirmer',
  message = 'Êtes-vous sûr ?',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger', // 'danger' | 'primary'
  onConfirm,
  onCancel,
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-w-md w-full p-6">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
