// Minimal classNames helper. Avoids pulling clsx/classnames just for joining.
export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
