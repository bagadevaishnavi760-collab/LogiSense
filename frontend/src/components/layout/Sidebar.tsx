import { Moon, PanelLeftClose, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV } from '../../data/nav'
import { cn } from '../../lib/cn'
import { Badge, Dot } from '../ui/badge'
import { Button } from '../ui/button'
import { Hint } from '../ui/tooltip'
import { useTheme } from '../../hooks/use-theme'
import { FACTS } from '../../lib/warehouse'

/* ------------------------------------------------------------------ *
 * Brand mark
 * ------------------------------------------------------------------ */

export function Logomark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative flex size-7 shrink-0 items-center justify-center rounded-md',
        'bg-gradient-to-b from-[#2f4b8f] to-[#1a2b52] ring-1 ring-white/10',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none">
        <path
          d="M3.5 7.2 12 3l8.5 4.2v9.6L12 21l-8.5-4.2V7.2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M12 12.2 20.5 8M12 12.2 3.5 8M12 12.2V21" stroke="currentColor" strokeWidth="1.3" strokeOpacity=".55" />
        <circle cx="12" cy="12.2" r="1.7" fill="currentColor" />
      </svg>
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Sidebar — deep navy in both themes. Collapsible on desktop,
 * slide-over on mobile.
 * ------------------------------------------------------------------ */

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const location = useLocation()
  const { theme, toggle } = useTheme()

  useEffect(() => {
    onCloseMobile()
  }, [location.pathname, onCloseMobile])

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-[rgb(8_11_18/0.5)] backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-nav-line bg-nav',
          'transition-[width,transform] duration-200 ease-out',
          'lg:relative lg:z-0 lg:translate-x-0',
          collapsed ? 'lg:w-[60px]' : 'lg:w-[236px]',
          'w-[262px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex h-14 shrink-0 items-center gap-2.5 border-b border-nav-line px-3.5',
            collapsed && 'lg:justify-center lg:px-0',
          )}
        >
          <Logomark />
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold leading-4 tracking-tight text-nav-fg">LogiSense</p>
              <p className="truncate text-[10.5px] leading-3.5 text-nav-fg-subtle">Logistics Intelligence</p>
            </div>
          ) : null}
          {!collapsed ? (
            <Hint label="Collapse sidebar" side="right">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onToggleCollapse}
                className="hidden text-nav-fg-muted hover:bg-nav-hover hover:text-nav-fg lg:inline-flex"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose />
              </Button>
            </Hint>
          ) : null}
        </div>

        {/* Navigation */}
        <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2.5 py-3" aria-label="Main">
          {NAV.map((section) => (
            <div key={section.label} className="mb-4 last:mb-0">
              {!collapsed ? (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-nav-fg-subtle">
                  {section.label}
                </p>
              ) : (
                <div className="mx-2 mb-2 h-px bg-nav-line" aria-hidden />
              )}
              <ul className="flex flex-col gap-0.5">
                {section.entries.map((entry) => {
                  const Icon = entry.icon
                  const link = (
                    <NavLink
                      to={entry.to}
                      end={entry.to === '/'}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] font-medium',
                          'transition-colors duration-150',
                          isActive
                            ? 'bg-nav-hover text-nav-fg'
                            : 'text-nav-fg-muted hover:bg-nav-hover/60 hover:text-nav-fg',
                          collapsed && 'lg:justify-center lg:px-0',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive ? (
                            <span
                              aria-hidden
                              className="absolute -left-2.5 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-[#5f8dfb]"
                            />
                          ) : null}
                          <Icon
                            className={cn(
                              'size-[15px] shrink-0 transition-colors',
                              isActive ? 'text-[#7ea6fc]' : 'text-nav-fg-subtle group-hover:text-nav-fg-muted',
                            )}
                          />
                          {!collapsed ? <span className="truncate">{entry.label}</span> : null}
                        </>
                      )}
                    </NavLink>
                  )

                  return (
                    <li key={entry.to}>
                      {collapsed ? (
                        <Hint label={entry.label} side="right">
                          {link}
                        </Hint>
                      ) : (
                        link
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Warehouse status */}
        <div className="shrink-0 border-t border-nav-line p-2.5">
          {collapsed ? (
            <Hint label="Warehouse online · 50,000 rows" side="right">
              <div className="flex items-center justify-center rounded-md border border-nav-line bg-nav-raised py-2">
                <Dot tone="success" pulse />
              </div>
            </Hint>
          ) : (
            <div className="rounded-md border border-nav-line bg-nav-raised p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-nav-fg">
                  <Dot tone="success" pulse />
                  Warehouse online
                </span>
                <Badge size="sm" className="border-nav-line bg-nav text-nav-fg-muted">
                  v1.4
                </Badge>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10.5px]">
                <dt className="text-nav-fg-subtle">Fact rows</dt>
                <dd className="tnum text-right font-medium text-nav-fg-muted">
                  {FACTS.orders.toLocaleString()}
                </dd>
                <dt className="text-nav-fg-subtle">Dimensions</dt>
                <dd className="tnum text-right font-medium text-nav-fg-muted">7 conformed</dd>
                <dt className="text-nav-fg-subtle">Late rate</dt>
                <dd className="tnum text-right font-medium text-nav-fg-muted">{FACTS.lateRate.toFixed(2)}%</dd>
              </dl>
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5">
            {collapsed ? (
              <Hint label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} side="right">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={toggle}
                  className="w-full text-nav-fg-muted hover:bg-nav-hover hover:text-nav-fg"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun /> : <Moon />}
                </Button>
              </Hint>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={toggle}
                  className="text-nav-fg-muted hover:bg-nav-hover hover:text-nav-fg"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun /> : <Moon />}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onToggleCollapse}
                  className="hidden flex-1 justify-start text-nav-fg-subtle hover:bg-nav-hover hover:text-nav-fg lg:inline-flex"
                >
                  <PanelLeftClose />
                  Collapse
                </Button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
