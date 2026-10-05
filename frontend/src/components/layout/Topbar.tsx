import type { ReactNode } from 'react'
import {
  Bell,
  ChevronDown,
  Menu,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  TriangleAlert,
  UserRound,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Dot } from '../ui/badge'
import { Button } from '../ui/button'
import { Hint } from '../ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown'
import { Modal, ModalContent } from '../ui/overlay'
import { Separator } from '../ui/controls'
import { Logomark } from './Sidebar'
import { getConnection, onConnectionChange, apiConfig, type ConnectionMode } from '../../services/api'
import { cn } from '../../lib/cn'

/* ------------------------------------------------------------------ *
 * Connection badge
 * ------------------------------------------------------------------ */

const CONNECTION: Record<ConnectionMode, { label: string; tone: 'success' | 'warning' | 'neutral'; hint: string }> = {
  live: {
    label: 'Live API',
    tone: 'success',
    hint: `Connected to ${apiConfig.baseUrl}. Requests are served by the Flask analytics API.`,
  },
  demo: {
    label: 'Demo data',
    tone: 'warning',
    hint: apiConfig.forceDemo
      ? 'VITE_DEMO_MODE=true — the UI is running entirely on the local warehouse, Flask is not required.'
      : `${apiConfig.baseUrl} is unreachable, so the local warehouse is serving every figure.`,
  },
  probing: {
    label: 'Connecting',
    tone: 'neutral',
    hint: 'Probing the analytics API…',
  },
}

export function ConnectionBadge({ className }: { className?: string }) {
  const [mode, setMode] = useState<ConnectionMode>(getConnection)

  useEffect(() => onConnectionChange(setMode), [])

  const cfg = CONNECTION[mode]

  return (
    <Hint label={cfg.hint}>
      <Badge
        variant={cfg.tone === 'neutral' ? 'neutral' : cfg.tone}
        size="md"
        className={cn('cursor-help', className)}
      >
        {mode === 'probing' ? (
          <RefreshCw className="size-3 animate-spin" />
        ) : mode === 'demo' ? (
          <Server className="size-3" />
        ) : (
          <Zap className="size-3" />
        )}
        {cfg.label}
      </Badge>
    </Hint>
  )
}

/* ------------------------------------------------------------------ *
 * Notifications
 * ------------------------------------------------------------------ */

interface Notification {
  id: string
  tone: 'danger' | 'warning' | 'info' | 'success'
  title: string
  body: string
  time: string
  unread: boolean
}

const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    tone: 'danger',
    title: 'WH-008 Sydney breached the late-rate guardrail',
    body: 'Late rate reached 61.2% over the trailing 14 days, 11 pts above the network average.',
    time: '14 min ago',
    unread: true,
  },
  {
    id: 'n2',
    tone: 'warning',
    title: 'Economy service level degrading',
    body: 'Average transit is 1.4 days over promise for Economy lanes in Western Europe.',
    time: '1 h ago',
    unread: true,
  },
  {
    id: 'n3',
    tone: 'info',
    title: 'Risk rescore batch finished',
    body: '48,710 shipments re-scored. 12.4% are above the 0.35 late-risk threshold.',
    time: '3 h ago',
    unread: true,
  },
  {
    id: 'n4',
    tone: 'success',
    title: 'ETL load succeeded',
    body: 'fact_delivery refreshed with 50,000 rows across 7 conformed dimensions.',
    time: '6 h ago',
    unread: false,
  },
]

function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(NOTIFICATIONS)
  const unread = items.filter((n) => n.unread).length

  return (
    <>
      <Hint label="Notifications">
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={`Notifications, ${unread} unread`}
          onClick={() => setOpen(true)}
        >
          <Bell />
          {unread ? (
            <span className="absolute right-1 top-1 flex size-1.5 rounded-full bg-danger ring-2 ring-canvas" />
          ) : null}
        </Button>
      </Hint>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent
          title="Notifications"
          description="Operational alerts raised by the warehouse and model monitoring jobs."
          footer={
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setItems((list) => list.map((n) => ({ ...n, unread: false })))}
              >
                Mark all read
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </>
          }
        >
          <ul className="divide-y divide-line-soft">
          {items.map((n) => (
            <li key={n.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-1.5">
                <Dot tone={n.tone === 'danger' ? 'danger' : n.tone === 'warning' ? 'warning' : n.tone === 'info' ? 'info' : 'success'} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[13px] font-medium leading-5 text-fg">
                  {n.title}
                  {n.unread ? <span className="size-1.5 shrink-0 rounded-full bg-brand" /> : null}
                </p>
                <p className="mt-0.5 text-xs leading-[1.55] text-fg-muted">{n.body}</p>
                <p className="mt-1 text-2xs text-fg-subtle">{n.time}</p>
              </div>
              </li>
            ))}
          </ul>
        </ModalContent>
      </Modal>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * User menu
 * ------------------------------------------------------------------ */

const USER = {
  name: 'Ananya Rao',
  email: 'a.rao@logisense.io',
  role: 'Head of Operations Analytics',
  org: 'LogiSense · Network Ops',
}

function UserMenu() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const initials = USER.name
    .split(' ')
    .map((p) => p[0])
    .join('')

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-surface-hover"
          aria-label="Account menu"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#3a5ea8] to-[#24365f] text-[11px] font-semibold text-white ring-1 ring-line">
            {initials}
          </span>
          <span className="hidden min-w-0 text-left lg:block">
            <span className="block max-w-[132px] truncate text-xs font-medium leading-4 text-fg">{USER.name}</span>
            <span className="block max-w-[132px] truncate text-[10.5px] leading-3.5 text-fg-subtle">
              {USER.role}
            </span>
          </span>
          <ChevronDown className="hidden size-3.5 shrink-0 text-fg-subtle lg:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[248px]">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#3a5ea8] to-[#24365f] text-xs font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-fg">{USER.name}</p>
            <p className="truncate text-2xs text-fg-muted">{USER.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <UserRound />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/model-monitoring')}>
          <Sparkles />
          Model registry
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/data-quality')}>
          <TriangleAlert />
          Data quality report
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-2xs text-fg-subtle">
          Signed in to <span className="font-medium text-fg-muted">{USER.org}</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------------------------------------------ *
 * Top bar
 * ------------------------------------------------------------------ */

export function Topbar({
  onOpenMobileNav,
  onExpandSidebar,
  sidebarCollapsed,
  onOpenSearch,
}: {
  onOpenMobileNav: () => void
  onExpandSidebar: () => void
  sidebarCollapsed: boolean
  onOpenSearch: () => void
}) {
  const location = useLocation()

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-md sm:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      {sidebarCollapsed ? (
        <Hint label="Expand sidebar" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:inline-flex"
            onClick={onExpandSidebar}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen />
          </Button>
        </Hint>
      ) : null}

      <div className="hidden items-center gap-2 lg:flex">
        <Logomark className="size-6" />
        <Separator orientation="vertical" className="mx-0.5 h-4" />
        <span className="text-xs font-medium text-fg-muted">{sectionLabel(location.pathname)}</span>
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        className="group ml-auto flex h-8 w-full max-w-[420px] items-center gap-2 rounded-md border border-line bg-surface-sunken px-2.5 text-left transition-[border-color,background-color] duration-150 hover:border-line-strong hover:bg-surface-hover lg:ml-4"
      >
        <Search className="size-3.5 shrink-0 text-fg-subtle transition-colors group-hover:text-fg-muted" />
        <span className="min-w-0 flex-1 truncate text-xs text-fg-subtle">
          Search orders, carriers, metrics…
        </span>
        <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle sm:flex">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <div className="hidden md:block">
          <ConnectionBadge />
        </div>
        <NotificationsMenu />
        <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
        <UserMenu />
      </div>
    </header>
  )
}

function sectionLabel(pathname: string): string {
  if (pathname === '/') return 'Network overview'
  if (pathname.startsWith('/olap')) return 'OLAP cube'
  if (pathname.startsWith('/orders')) return 'Fact table'
  if (pathname.startsWith('/risk')) return 'Model inference'
  if (pathname.startsWith('/carrier')) return 'Carrier analytics'
  if (pathname.startsWith('/delivery')) return 'Delivery analytics'
  if (pathname.startsWith('/data-quality')) return 'Data quality'
  if (pathname.startsWith('/model-monitoring')) return 'Model monitoring'
  if (pathname.startsWith('/admin')) return 'Platform admin'
  if (pathname.startsWith('/settings')) return 'Preferences'
  return 'Workspace'
}

/* ------------------------------------------------------------------ *
 * Page header — title, description, actions. Used on every route so the
 * vertical rhythm is identical product-wide.
 * ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  children,
}: {
  eyebrow?: ReactNode
  title: string
  description?: string
  actions?: ReactNode
  meta?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-2xl">
          {eyebrow ? (
            <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-fg-subtle">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[21px] font-semibold leading-7 tracking-[-0.025em] text-fg sm:text-[23px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 text-[13px] leading-[1.55] text-fg-muted text-pretty">{description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      {meta ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-2 text-2xs text-fg-muted">
          {meta}
        </div>
      ) : null}

      {children}
    </div>
  )
}

export function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-fg-subtle">{label}</span>
      <span className="tnum font-medium text-fg-secondary">{value}</span>
    </span>
  )
}
