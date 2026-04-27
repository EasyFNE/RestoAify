import { cn } from '../lib/cn.js'

export default function Button({ variant = 'primary', className, ...props }) {
  const cls = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
  }[variant] || 'btn-primary'
  return <button className={cn(cls, className)} {...props} />
}
