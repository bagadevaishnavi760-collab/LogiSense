import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Calendar, CalendarRange, ChevronDown, RotateCcw, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Hint } from '../ui/tooltip'
import { Segmented } from '../ui/controls'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Checkbox } from '../ui/toggle'
import { cn } from '../../lib/cn'
import { dayIndexOf, formatIso, indexToDate } from '../../services/time'
import { formatDate } from '../../lib/format'
import { CARRIERS, CATEGORIES, SEGMENTS, SHIPPING_METHODS, WAREHOUSES } from '../../lib/warehouse'
import { getOrderRows } from '../../data/orders'
import type { Granularity } from '../../services/analytics'
import type { Filters, FilterMeta } from '../../types'

/* ------------------------------------------------------------------ *
 * Filter state lives in the URL, so every view is shareable and the
 * back button behaves.
 * ------------------------------------------------------------------ */

export interface DatePreset {
  id: string
  label: string
  short: string
  days: number
}

export const DATE_PRESETS: DatePreset[] = [
  { id: '7d', label: 'Last 7 days', short: '7D', days: 7 },
  { id: '30d', label: 'Last 30 days', short: '30D', days: 30 },
  { id: '90d', label: 'Last 90 days', short: '90D', days: 90 },
  { id: '180d', label: 'Last 6 months', short: '6M', days: 180 },
  { id: '365d', label: 'Full year', short: '12M', days: 365 },
]

const ARRAY_KEYS = ['carriers', 'warehouses', 'countries', 'segments', 'categories', 'shippingMethods'] as const

type ArrayKey = (typeof ARRAY_KEYS)[number]

export const FILTER_OPTIONS: FilterMeta[] = [
  { key: 'carriers', label: 'Carrier', options: CARRIERS },
  { key: 'warehouses', label: 'Warehouse', options: WAREHOUSES.map((w) => `${w.id} · ${w.city}`) },
  { key: 'segments', label: 'Segment', options: SEGMENTS },
  { key: 'categories', label: 'Category', options: CATEGORIES },
  { key: 'shippingMethods', label: 'Service', options: SHIPPING_METHODS },
]

const EMPTY: Filters = {
  from: indexToDate(0),
  to: indexToDate(364),
  carriers: [],
  warehouses: [],
  countries: [],
  segments: [],
  categories: [],
  shippingMethods: [],
}

/** Warehouse option value → the `warehouseId` stored on each fact row. */
export function warehouseIdOf(option: string): string {
  return option.split(' · ')[0]
}

export function useFilters() {
  const [params, setParams] = useSearchParams()

  const filters: Filters = useMemo(() => {
    const from = params.get('from')
    const to = params.get('to')
    const readArray = (key: ArrayKey) => {
      const raw = params.get(key)
      return raw ? raw.split(',').filter(Boolean) : EMPTY[key]
    }
    return {
      from: from ?? EMPTY.from,
      to: to ?? EMPTY.to,
      carriers: readArray('carriers'),
      warehouses: readArray('warehouses').map(warehouseIdOf),
      countries: readArray('countries'),
      segments: readArray('segments'),
      categories: readArray('categories'),
      shippingMethods: readArray('shippingMethods'),
    }
  }, [params])

  const granularity = (params.get('granularity') as Granularity | null) ?? 'auto'

  const patch = useCallback(
    (next: Partial<Filters>) => {
      const draft = new URLSearchParams(params)
      for (const [key, value] of Object.entries(next)) {
        if (Array.isArray(value)) {
          if (value.length) draft.set(key, value.join(','))
          else draft.delete(key)
        } else if (value) {
          draft.set(key, String(value))
        } else {
          draft.delete(key)
        }
      }
      setParams(draft, { replace: true })
    },
    [params, setParams],
  )

  const toggle = useCallback(
    (key: ArrayKey, value: string) => {
      const current = filters[key]
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
      patch({ [key]: next } as Partial<Filters>)
    },
    [filters, patch],
  )

  const setPreset = useCallback(
    (days: number) => {
      patch({ from: indexToDate(365 - days), to: indexToDate(364) })
    },
    [patch],
  )

  const setRange = useCallback(
    (fromIndex: number, toIndex: number) => {
      patch({ from: formatIso(fromIndex), to: formatIso(toIndex) })
    },
    [patch],
  )

  const setGranularity = useCallback(
    (g: Granularity | 'auto') => {
      const draft = new URLSearchParams(params)
      if (g === 'auto') draft.delete('granularity')
      else draft.set('granularity', g)
      setParams(draft, { replace: true })
    },
    [params, setParams],
  )

  const clearAll = useCallback(() => {
    const draft = new URLSearchParams()
    const q = params.get('q')
    const tab = params.get('tab')
    if (q) draft.set('q', q)
    if (tab) draft.set('tab', tab)
    setParams(draft, { replace: true })
  }, [params, setParams])

  const spanDays = dayIndexOf(filters.to) - dayIndexOf(filters.from) + 1
  const activeCount = ARRAY_KEYS.reduce((a: number, k) => a + filters[k].length, 0)

  return {
    filters,
    granularity,
    spanDays,
    activeCount,
    patch,
    toggle,
    setPreset,
    setRange,
    setGranularity,
    clearAll,
  }
}

/** Resolve the effective granularity for a given window length. */
export function resolveGranularity(pref: Granularity | 'auto', spanDays: number): Granularity {
  if (pref !== 'auto') return pref
  if (spanDays <= 31) return 'day'
  if (spanDays <= 120) return 'week'
  return 'month'
}

/* ------------------------------------------------------------------ *
 * Filter bar UI
 * ------------------------------------------------------------------ */

export function FilterBar({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  const { filters, spanDays, activeCount, setPreset, setRange, clearAll, toggle, patch } = useFilters()

  const activePreset =
    DATE_PRESETS.find((p) => dayIndexOf(filters.to) === 364 && 365 - dayIndexOf(filters.from) === p.days)?.id ??
    'custom'

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <CalendarRange className="size-4 shrink-0 text-fg-subtle" />
        <Segmented
          size="sm"
          ariaLabel="Date range preset"
          value={activePreset}
          onChange={(v) => {
            const preset = DATE_PRESETS.find((p) => p.id === v)
            if (preset) setPreset(preset.days)
          }}
          options={[
            ...DATE_PRESETS.map((p) => ({ value: p.id, label: p.short })),
            ...(activePreset === 'custom' ? [{ value: 'custom', label: 'Custom' }] : []),
          ]}
        />
        <DateRangePicker onChange={setRange} from={filters.from} to={filters.to} />
      </div>

      <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />

      <MultiSelect
        label="Carrier"
        options={CARRIERS}
        selected={filters.carriers}
        onToggle={(v) => toggle('carriers', v)}
        onClear={() => patch({ carriers: [] })}
      />
      <MultiSelect
        label="Warehouse"
        options={WAREHOUSES.map((w) => `${w.id} · ${w.city}`)}
        selected={filters.warehouses.map((id) => {
          const w = WAREHOUSES.find((x) => x.id === id)
          return w ? `${w.id} · ${w.city}` : id
        })}
        onToggle={(v) => toggle('warehouses', v)}
        onClear={() => patch({ warehouses: [] })}
      />
      <MultiSelect
        label="Segment"
        options={SEGMENTS}
        selected={filters.segments}
        onToggle={(v) => toggle('segments', v)}
        onClear={() => patch({ segments: [] })}
      />
      <MultiSelect
        label="Service"
        options={SHIPPING_METHODS}
        selected={filters.shippingMethods}
        onToggle={(v) => toggle('shippingMethods', v)}
        onClear={() => patch({ shippingMethods: [] })}
      />

      {children}

      <div className="ml-auto flex items-center gap-2">
        <span className="tnum hidden text-2xs text-fg-subtle xl:inline">
          {spanDays} day{spanDays === 1 ? '' : 's'} selected
        </span>
        {activeCount > 0 ? (
          <Button variant="ghost" size="xs" onClick={clearAll}>
            <RotateCcw />
            Reset {activeCount}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Date range picker — dual-handle brush over the warehouse year.
 * ------------------------------------------------------------------ */

function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (fromIndex: number, toIndex: number) => void
}) {
  const [open, setOpen] = useState(false)
  const lo = dayIndexOf(from)
  const hi = dayIndexOf(to)
  const span = Math.max(0, hi - lo)
  const orders = getOrderRows()

  // Monthly order volume — the brush backdrop, so density is visible.
  const months = useMemo(() => {
    const buckets = new Array(12).fill(0) as number[]
    for (const o of orders) buckets[o.month - 1] += 1
    const max = Math.max(...buckets)
    return buckets.map((v) => v / max)
  }, [orders])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5 font-normal">
          <Calendar className="size-3.5 text-fg-subtle" />
          <span className="tnum text-xs">
            {formatDate(from)} — {formatDate(to)}
          </span>
          <ChevronDown className="size-3 text-fg-subtle" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px]" align="start">
        <p className="mb-3 text-2xs font-semibold uppercase tracking-[0.09em] text-fg-muted">
          Order volume across 2026
        </p>

        <div className="relative">
          <div className="flex h-16 items-end gap-[3px]">
            {months.map((h, i) => {
              const monthStart = i * 30.4
              const monthEnd = (i + 1) * 30.4
              const covered = monthEnd >= lo && monthStart <= hi
              return (
                <span
                  key={i}
                  style={{ height: `${Math.max(8, h * 100)}%` }}
                  className={cn(
                    'flex-1 rounded-[2px] transition-colors',
                    covered ? 'bg-brand/55' : 'bg-surface-sunken',
                  )}
                />
              )
            })}
          </div>

          <div className="relative mt-2">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand"
              style={{ left: `${(lo / 364) * 100}%`, right: `${100 - (hi / 364) * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={364}
              value={lo}
              aria-label="Range start"
              onChange={(e) => {
                const next = Math.min(Number(e.target.value), hi)
                onChange(next, hi)
              }}
              className="range-thumb relative z-10 w-full"
            />
            <input
              type="range"
              min={0}
              max={364}
              value={hi}
              aria-label="Range end"
              onChange={(e) => {
                const next = Math.max(Number(e.target.value), lo)
                onChange(lo, next)
              }}
              className="range-thumb relative z-10 mt-1 w-full"
            />
          </div>

          <div className="mt-1.5 flex justify-between text-2xs text-fg-subtle">
            <span>Jan 2026</span>
            <span className="tnum font-medium text-fg-secondary">{span + 1} days selected</span>
            <span>Dec 2026</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line-soft pt-3 text-2xs">
          <div>
            <span className="text-fg-subtle">From</span>
            <p className="tnum font-medium text-fg">{formatDate(from)}</p>
          </div>
          <div>
            <span className="text-fg-subtle">To</span>
            <p className="tnum font-medium text-fg">{formatDate(to)}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------------------ *
 * Multi-select facet popover
 * ------------------------------------------------------------------ */

function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  onClear,
  searchable = true,
}: {
  label: string
  options: readonly string[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const visible = query
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={selected.length ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'gap-1.5 font-normal',
            selected.length && 'border-brand-line bg-brand-soft text-brand-soft-fg hover:bg-brand-soft',
          )}
        >
          {label}
          {selected.length ? (
            <Badge variant="brand" size="sm" className="tnum px-1">
              {selected.length}
            </Badge>
          ) : null}
          <ChevronDown className="size-3 text-fg-subtle" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[236px]" align="start">
        <div className="flex items-center justify-between gap-2 pb-2">
          <p className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-muted">{label}</p>
          {selected.length ? (
            <button
              type="button"
              onClick={onClear}
              className="text-2xs text-fg-subtle transition-colors hover:text-fg"
            >
              Clear
            </button>
          ) : null}
        </div>

        {searchable && options.length > 8 ? (
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${label.toLowerCase()}`}
            className="mb-2 h-7 text-xs"
          />
        ) : null}

        <div className="scrollbar-thin -mx-1 max-h-[240px] overflow-y-auto px-1">
          {visible.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-fg-muted">No matches</p>
          ) : (
            visible.map((option) => {
              const active = selected.includes(option)
              return (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5 transition-colors hover:bg-surface-hover"
                >
                  <Checkbox checked={active} onCheckedChange={() => onToggle(option)} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-fg-secondary">{option}</span>
                </label>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------------------ *
 * Active filter chips
 * ------------------------------------------------------------------ */

export function ActiveFilters({ className }: { className?: string }) {
  const { filters, toggle, clearAll, activeCount } = useFilters()

  const chips: { key: string; label: string; onRemove: () => void }[] = []
  for (const [key, values] of Object.entries(filters)) {
    if (key === 'from' || key === 'to') continue
    for (const v of values as string[]) {
      chips.push({
        key: `${key}:${v}`,
        label: v,
        onRemove: () => toggle(key as ArrayKey, key === 'warehouses' ? `${v}` : v),
      })
    }
  }

  if (!chips.length) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">Filters</span>
      {chips.map((chip) => (
        <Hint key={chip.key} label="Remove filter">
          <button
            type="button"
            onClick={chip.onRemove}
            className="group inline-flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 text-2xs text-fg-secondary transition-colors hover:border-danger/30 hover:bg-danger-soft hover:text-danger-fg"
          >
            {chip.label}
            <X className="size-2.5 text-fg-subtle transition-colors group-hover:text-danger" />
          </button>
        </Hint>
      ))}
      {activeCount > 1 ? (
        <button
          type="button"
          onClick={clearAll}
          className="ml-1 text-2xs text-fg-subtle underline-offset-2 transition-colors hover:text-fg hover:underline"
        >
          Clear all
        </button>
      ) : null}
    </div>
  )
}
