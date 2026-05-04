import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { getMenuForScope } from '../config/menu.js'
import { useAuth } from '../hooks/useAuth.js'
import { cn } from '../lib/cn.js'
import logoImg from '../assets/logo.jpg'

// ─────────────────────────────────────────────────────────────────────────────
// Retourne true si la route courante correspond à cet item ou est dans son
// sous-arbre. '/app' et '/platform' sont en exact-match pour éviter de tout
// matcher sous le scope.
// ─────────────────────────────────────────────────────────────────────────────
function isPathActive(currentPath, itemPath) {
  if (itemPath === '/app' || itemPath === '/platform') {
    return currentPath === itemPath
  }
  return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
}

export default function Sidebar({ scope }) {
  const { currentUser } = useAuth()
  const location = useLocation()
  const groups = getMenuForScope(scope, { role: currentUser?.role })

  // ── Calcule la section initiale ouverte (celle qui contient la route active)
  const computeInitialOpenSections = () => {
    const open = new Set()
    for (const g of groups) {
      if (g.items.some(i => isPathActive(location.pathname, i.path))) {
        open.add(g.section)
      }
    }
    if (open.size === 0 && groups.length > 0) open.add(groups[0].section)
    return open
  }

  const [openSections, setOpenSections] = useState(computeInitialOpenSections)

  // À chaque changement de route, force l’ouverture de la section qui contient
  // la nouvelle route active (sans refermer celles déjà ouvertes).
  useEffect(() => {
    setOpenSections(prev => {
      const next = new Set(prev)
      for (const g of groups) {
        if (g.items.some(i => isPathActive(location.pathname, i.path))) {
          next.add(g.section)
        }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  function toggleSection(section) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  return (
    <aside className="w-60 shrink-0 bg-gray-900 text-gray-200 flex flex-col">
      {/* Logo / en-tête */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
        <img
          src={logoImg}
          alt="RestoAify"
          className="h-10 w-10 rounded-xl object-cover shrink-0"
        />
        <div className="min-w-0">
          <div className="font-semibold text-white leading-tight">RestoAify</div>
          <div className="text-xs text-gray-400 mt-0.5 truncate">
            {scope === 'platform' ? 'Platform Admin' : 'Tenant Admin'}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Navigation principale">
        {groups.map(group => {
          const isOpen = openSections.has(group.section)
          const sectionId = `sidebar-section-${group.section}`

          return (
            <div key={group.section} className="mt-1 first:mt-0">
              {/* Titre de section — cliquable */}
              <button
                type="button"
                onClick={() => toggleSection(group.section)}
                aria-expanded={isOpen}
                aria-controls={sectionId}
                className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200 transition-colors select-none"
              >
                <span>{group.title}</span>
                {/* Chevron animé */}
                <svg
                  className={cn(
                    'h-3 w-3 shrink-0 transition-transform duration-200',
                    isOpen ? 'rotate-180' : 'rotate-0',
                  )}
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="2,4 6,8 10,4" />
                </svg>
              </button>

              {/* Items de la section — visibles si ouvert */}
              {isOpen && (
                <ul id={sectionId} className="pb-1">
                  {group.items.map(item => (
                    <li key={item.key}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/app' || item.path === '/platform'}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center px-4 py-2 text-sm hover:bg-gray-800 transition-colors',
                            isActive
                              ? 'bg-gray-800 text-white border-l-2 border-brand-500 -ml-px pl-[15px]'
                              : 'text-gray-300',
                          )
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      {/* Pied de sidebar */}
      <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
        v0.1.0 · RestoAify
      </div>
    </aside>
  )
}
