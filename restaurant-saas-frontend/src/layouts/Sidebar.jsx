import { NavLink } from 'react-router-dom'
import { getMenuForScope } from '../config/menu.js'
import { useAuth } from '../hooks/useAuth.js'
import { cn } from '../lib/cn.js'

export default function Sidebar({ scope }) {
  const { currentUser } = useAuth()
  const groups = getMenuForScope(scope, { role: currentUser?.role })

  return (
    <aside className="w-60 shrink-0 bg-gray-900 text-gray-200 flex flex-col">
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="font-semibold text-white">Restaurant SaaS</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {scope === 'platform' ? 'Platform Admin' : 'Tenant Admin'}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map(group => (
          <div key={group.section} className="mt-4 first:mt-0">
            <div className="px-4 mb-1 text-[10px] uppercase tracking-wider text-gray-500">
              {group.title}
            </div>
            <ul>
              {group.items.map(item => (
                <li key={item.key}>
                  {item.status === 'reserved' ? (
                    <NavLink
                      to={item.path}
                      className="flex items-center justify-between px-4 py-2 text-sm text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] uppercase bg-gray-800 px-1.5 py-0.5 rounded">
                        Bientôt
                      </span>
                    </NavLink>
                  ) : (
                    <NavLink
                      to={item.path}
                      end={item.path === '/app' || item.path === '/platform'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center px-4 py-2 text-sm hover:bg-gray-800',
                          isActive
                            ? 'bg-gray-800 text-white border-l-2 border-brand-500 -ml-px pl-[15px]'
                            : 'text-gray-300',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
        v0.1.0 · mock data
      </div>
    </aside>
  )
}
