import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-full flex items-center justify-center bg-gray-100 p-6">
      <Outlet />
    </div>
  )
}
