import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { Topbar } from '../components/layout/Topbar'
import { CommandPalette } from '../components/layout/CommandPalette'
import { Drawer, DrawerContent } from '../components/ui/overlay'
import { Button } from '../components/ui/button'
import { Toaster } from 'sonner'
import { cn } from '../lib/cn'
import { useTheme } from '../hooks/use-theme'

const SIDEBAR_KEY = 'logisense.sidebar.collapsed'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const [mobileNav, setMobileNav] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const { theme } = useTheme()

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    setMobileNav(false)
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
      if (e.key === '/' && !isTyping(e.target)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const expand = useCallback(() => setCollapsed(false), [])

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas text-fg">
      {/* Desktop sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={false}
        onCloseMobile={() => undefined}
      />

      {/* Mobile nav drawer */}
      <Drawer open={mobileNav} onOpenChange={setMobileNav}>
        <DrawerContent side="left" width="w-[272px] max-w-[86vw]" title="Navigation">
          <Sidebar
            collapsed={false}
            onToggleCollapse={() => setCollapsed((c) => !c)}
            mobileOpen={false}
            onCloseMobile={() => setMobileNav(false)}
          />
        </DrawerContent>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          sidebarCollapsed={collapsed}
          onExpandSidebar={expand}
          onOpenMobileNav={() => setMobileNav(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <main
          className={cn(
            'scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden',
            'px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6',
          )}
        >
          <div className="mx-auto w-full max-w-[1560px]">
            <Outlet />
          </div>
        </main>

        <footer className="hidden shrink-0 items-center justify-between gap-4 border-t border-line px-5 py-2 text-2xs text-fg-subtle lg:flex">
          <span>LogiSense · Supply Chain Intelligence</span>
          <span className="flex items-center gap-3">
            <span>Warehouse fact_delivery · 50,000 rows</span>
            <span className="text-line-strong">|</span>
            <span>{theme === 'dark' ? 'Dark' : 'Light'} theme</span>
          </span>
        </footer>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      <Toaster
        theme={theme}
        position="bottom-right"
        offset={16}
        toastOptions={{ className: 'logisense-toast' }}
      />
    </div>
  )
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/** Route-level error boundary + 404. Used by the router. */
export function RouteFallback({ title = 'Something went wrong' }: { title?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="max-w-sm text-xs text-fg-muted">
        The view could not be rendered. Try clearing the URL filters, or return to the overview.
      </p>
      <Button variant="secondary" size="sm" asChild>
        <a href="/">Back to overview</a>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 text-center">
      <p className="tnum text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Error 404</p>
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">This route does not exist</h1>
      <p className="mt-1 max-w-md text-[13px] text-fg-muted">
        The page you requested is not part of the LogiSense workspace. Use the sidebar, or press{' '}
        <kbd className="rounded border border-line bg-surface-sunken px-1 font-mono text-[11px]">⌘K</kbd> to
        search for what you need.
      </p>
      <Button variant="secondary" size="sm" className="mt-3" asChild>
        <a href="/">Go to network overview</a>
      </Button>
    </div>
  )
}