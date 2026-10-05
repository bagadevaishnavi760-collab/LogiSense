import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CornerDownLeft, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NAV } from '../../data/nav'
import { getOrderRows } from '../../data/orders'
import { cn } from '../../lib/cn'
import { formatCompactCurrency } from '../../lib/format'

type Kind = 'page' | 'order' | 'metric'

interface Command {
  id: string
  kind: Kind
  label: string
  meta?: string
  to: string
  search: string
}

const KIND_LABEL: Record<Kind, string> = {
  page: 'Navigate',
  order: 'Order',
  metric: 'Jump to',
}

const METRIC_SHORTCUTS: Command[] = [
  {
    id: 'm:late',
    kind: 'metric',
    label: 'Late delivery rate',
    meta: 'Network service metric',
    to: '/delivery-analytics?tab=service',
    search: 'late delay otd ontime service performance',
  },
  {
    id: 'm:risk',
    kind: 'metric',
    label: 'At-risk shipments',
    meta: 'Model-scored above threshold',
    to: '/risk-prediction',
    search: 'risk model score threshold prediction',
  },
  {
    id: 'm:spend',
    kind: 'metric',
    label: 'Shipping spend',
    meta: 'Carrier invoicing total',
    to: '/carrier-analytics?tab=cost',
    search: 'cost spend freight money carrier',
  },
  {
    id: 'm:drift',
    kind: 'metric',
    label: 'Model drift (PSI)',
    meta: 'Population stability index',
    to: '/model-monitoring?tab=drift',
    search: 'drift psi monitoring model',
  },
]

const PAGE_COMMANDS: Command[] = NAV.flatMap((section) =>
  section.entries.map((entry) => ({
    id: `p:${entry.to}`,
    kind: 'page' as Kind,
    label: entry.label,
    meta: entry.description,
    to: entry.to,
    search: `${entry.label} ${entry.description} ${section.label.toLowerCase()} ${(entry.keywords ?? []).join(' ')}`,
  })),
)

function score(query: string, haystack: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const h = haystack.toLowerCase()
  if (h === q) return 1000
  if (h.startsWith(q)) return 620
  const idx = h.indexOf(q)
  if (idx >= 0) return 340 - Math.min(idx, 150)
  let i = 0
  for (const ch of q) {
    i = h.indexOf(ch, i)
    if (i < 0) return 0
    i += 1
  }
  return 45
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const base = [...PAGE_COMMANDS, ...METRIC_SHORTCUTS]

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      const orders = getOrderRows()
        .filter((o) => o.id.toLowerCase().includes(q) || o.customerId.toLowerCase().includes(q))
        .slice(0, 4)
        .map<Command>((o) => ({
          id: `o:${o.id}`,
          kind: 'order',
          label: o.id,
          meta: `${o.customerId} · ${o.carrier} · ${o.city}, ${o.country} · ${formatCompactCurrency(o.orderValue)}`,
          to: `/orders?q=${encodeURIComponent(o.id)}`,
          search: `${o.id} ${o.customerId} ${o.carrier} ${o.city} ${o.country} ${o.warehouseCity}`,
        }))
      base.push(...orders)
    }

    return base
      .map((c) => ({ c, s: score(query, `${c.label} ${c.search} ${c.meta ?? ''}`) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.c)
  }, [query])

  const go = (cmd: Command) => {
    navigate(cmd.to)
    onOpenChange(false)
    setQuery('')
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-[rgb(8_11_18/0.5)] backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-[81] w-[calc(100vw-2rem)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface-raised shadow-pop data-[state=open]:animate-rise"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Search LogiSense</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Jump to a page, metric or order
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2.5 border-b border-line px-3.5">
            <Search className="size-4 shrink-0 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  const list = e.currentTarget.parentElement?.nextElementSibling
                  const buttons = list?.querySelectorAll<HTMLButtonElement>('button[data-cmd]')
                  if (!buttons?.length) return
                  const idx = [...buttons].findIndex((b) => b === document.activeElement)
                  const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
                  buttons[next < 0 ? buttons.length - 1 : next % buttons.length]?.focus()
                }
                if (e.key === 'Enter') {
                  const active = document.activeElement
                  if (active instanceof HTMLButtonElement && active.dataset.cmd) active.click()
                  else if (results[0]) go(results[0])
                }
              }}
              placeholder="Search pages, metrics and orders…"
              className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
            />
            <kbd className="hidden shrink-0 rounded border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle sm:block">
              ESC
            </kbd>
          </div>

          <div className="scrollbar-thin max-h-[52vh] overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-fg-muted">
                No matches for “{query}”. Try an order ID like ORD-004821.
              </p>
            ) : (
              results.map((cmd, i) => {
                const entry = NAV.flatMap((s) => s.entries).find((e) => e.label === cmd.label)
                const Icon = entry?.icon
                return (
                  <button
                    key={cmd.id}
                    data-cmd={cmd.id}
                    type="button"
                    onClick={() => go(cmd)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                      i === 0 ? 'bg-surface-hover' : 'hover:bg-surface-hover',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md border',
                        cmd.kind === 'order' && 'border-violet/25 bg-violet-soft text-violet-fg',
                        cmd.kind === 'metric' && 'border-teal/25 bg-teal-soft text-teal-fg',
                        cmd.kind === 'page' && 'border-brand-line bg-brand-soft text-brand',
                      )}
                    >
                      {Icon ? <Icon className="size-3.5" /> : <Search className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-fg">{cmd.label}</span>
                      {cmd.meta ? (
                        <span className="block truncate text-xs text-fg-muted">{cmd.meta}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-2xs uppercase tracking-[0.08em] text-fg-subtle">
                      {KIND_LABEL[cmd.kind]}
                    </span>
                    <CornerDownLeft
                      className={cn(
                        'size-3.5 shrink-0 text-fg-subtle',
                        i === 0 ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </button>
                )
              })
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-line bg-surface-sunken px-3.5 py-2 text-2xs text-fg-subtle">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">↑↓</kbd> navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">↵</kbd> open
            </span>
            <span className="ml-auto">{results.length} results</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
