export default function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  required,
  error,
  options, // for select
  placeholder,
  helpText,
  as = 'input', // input | select | textarea
}) {
  const id = `f-${name}`
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {as === 'select' ? (
        <select
          id={id}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          required={required}
          className="input"
        >
          <option value="" disabled>— choisir —</option>
          {options?.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : as === 'textarea' ? (
        <textarea
          id={id}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          rows={3}
          className="input"
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          value={value ?? ''}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className="input"
        />
      )}

      {helpText && !error && (
        <div className="text-xs text-gray-500 mt-1">{helpText}</div>
      )}
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  )
}
