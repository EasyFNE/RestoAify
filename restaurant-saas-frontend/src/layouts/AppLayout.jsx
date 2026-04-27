import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

export default function AppLayout({ scope }) {
  return (
    <div className="h-full flex">
      <Sidebar scope={scope} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar scope={scope} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
