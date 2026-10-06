import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Package, RotateCcw, Undo2 } from 'lucide-react'
import { PageHeader } from '../components/layout/Topbar'
import { FilterBar, DATE_PRESETS, resolveGranularity, useFilters } from '../components/common/filter-bar'
import { Panel, PanelBody, PanelHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { EmptyState, ErrorState } from '../components/ui/states'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Checkbox } from '../components/ui/toggle'
import { TableWrap, THead, TBody, TR, TH, TD } from '../components/ui/table'
import { SEMANTIC } from '../components/charts/theme'
import { TrendChart } from '../components/charts/trend'
import { RankedBars } from '../components/charts/bars'
import { DonutChart } from '../components/charts/radial'
import { formatCompact, formatCompactCurrency, formatNumber, formatPercent, formatDays } from '../lib/format'
import { cn } from '../lib/cn'
import { CATEGORIES, COUNTRIES } from '../lib/warehouse'
import {
  selectOrders,
  summarise,
  rankBy,
  timeSeries,
  type Granularity,
  type Summary,
} from '../services/analytics'
import type { Filters, RankRow, Slice, TimePoint } from '../types'
import type { Order } from '../lib/warehouse'

type SortKey = 'name' | 'orders' | 'lateRate' | 'onTimeRate' | 'avgDays' | 'avgDelay' | 'returnRate'

interface DeliveryRow extends RankRow {
  avgDelay: number
}

interface DeliverySnapshot {
  orders: Order[]
  summary: Summary
  series: TimePoint[]
  carriers: RankRow[]
  methods: RankRow[]
}

function FacetPopover({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string
  options: readonly string[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
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
          {selected.length ? <Badge variant="brand" size="sm" className="tnum px-1">{selected.length}</Badge> : null}
          <span className="text-fg-subtle">⌄</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[236px]" align="start">
        <div className="flex items-center justify-between gap-2 pb-2">
          <p className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-muted">{label}</p>
          {selected.length ? (
            <button type="button" onClick={onClear} className="text-2xs text-fg-subtle hover:text-fg">Clear</button>
          ) : null}
        </div>
        <div className="scrollbar-thin -mx-1 max-h-[240px] overflow-y-auto px-1">
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5 hover:bg-surface-hover"
            >
              <Checkbox checked={selected.includes(option)} onCheckedChange={() => onToggle(option)} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg-secondary">{option}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-live="polite" aria-label="Loading delivery analytics">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[98px] animate-pulse rounded-md border border-line bg-surface-sunken" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[320px] animate-pulse rounded-lg border border-line bg-surface-sunken" />)}
      </div>
    </div>
  )
}

export default function DeliveryAnalytics() {
  const { filters, granularity, spanDays, clearAll, patch } = useFilters()
  const resolvedGranularity: Granularity = resolveGranularity(granularity as Granularity, spanDays)
  const [snapshot, setSnapshot] = useState<DeliverySnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [sort, updateSortState] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'lateRate', direction: 'desc' })

  const filterKey = [
    filters.from, filters.to, filters.carriers.join(','), filters.warehouses.join(','),
    filters.countries.join(','), filters.segments.join(','), filters.categories.join(','),
    filters.shippingMethods.join(','), resolvedGranularity, retry,
  ].join('|')

  useEffect(() => {
    let cancelled = false
    setSnapshot(null)
    setLoadError(null)
    const frame = window.requestAnimationFrame(() => {
      try {
        const orders = selectOrders(filters)
        const next: DeliverySnapshot = {
          orders,
          summary: summarise(orders),
          series: timeSeries(orders, resolvedGranularity),
          carriers: rankBy(orders, (o) => o.carrier),
          methods: rankBy(orders, (o) => o.shippingMethod),
        }
        if (!cancelled) setSnapshot(next)
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'The delivery data could not be read.')
        }
      }
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [filterKey])

  const summary = snapshot?.summary
  const orders = snapshot?.orders ?? []
  const carrierRows = useMemo<DeliveryRow[]>(() => {
    if (!snapshot) return []
    return snapshot.carriers.map((row) => ({
      ...row,
      avgDelay: summarise(orders.filter((order) => order.carrier === row.name)).avgDelay,
    }))
  }, [snapshot, orders])

  const sortedCarrierRows = useMemo(() => {
    return [...carrierRows].sort((a, b) => {
      const left = a[sort.key]
      const right = b[sort.key]
      const result = typeof left === 'string' && typeof right === 'string'
        ? left.localeCompare(right)
        : Number(left) - Number(right)
      return sort.direction === 'asc' ? result : -result
    })
  }, [carrierRows, sort])

  const toggleFacet = (key: 'countries' | 'categories', value: string) => {
    const current = filters[key]
    patch({ [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] } as Partial<Filters>)
  }

  const setSort = (key: SortKey) => {
    updateSortState((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'name' ? 'asc' : 'desc' })
  }

  const statusSplit: Slice[] = summary
    ? [
        { name: 'On time', value: summary.onTimeRate, count: summary.onTime, color: 'success' },
        { name: 'Late', value: summary.lateRate, count: summary.late, color: 'danger' },
      ]
    : []

  const trendSeries = [
    { key: 'onTimeRate', label: 'On-time rate', color: SEMANTIC.success, axis: 'right' as const, format: 'percent' as const },
    { key: 'lateRate', label: 'Late rate', color: SEMANTIC.danger, axis: 'right' as const, format: 'percent' as const },
  ]

  const kpis = summary ? [
    { label: 'Total Orders', value: formatCompact(summary.orders), icon: <Package className="size-4 text-brand" /> },
    { label: 'On-Time Delivery Rate', value: formatPercent(summary.onTimeRate, 1), icon: <CheckCircle2 className="size-4 text-success" /> },
    { label: 'Late Delivery Rate', value: formatPercent(summary.lateRate, 1), icon: <AlertTriangle className="size-4 text-danger" /> },
    { label: 'Average Delivery Days', value: formatDays(summary.avgDays), icon: <CalendarDays className="size-4 text-info" /> },
    { label: 'Average Delivery Delay', value: formatDays(summary.avgDelay), icon: <Clock3 className="size-4 text-warning" /> },
    { label: 'Return Rate', value: formatPercent(summary.returnRate, 1), icon: <Undo2 className="size-4 text-violet" /> },
  ] : []

  const presetLabel = DATE_PRESETS.find((preset) => preset.days === spanDays)?.label ?? `${filters.from} → ${filters.to}`

  return (
    <div className="space-y-5">
      <PageHeader
        title="Delivery Analytics"
        description="Measure delivery reliability across carriers, service levels, warehouses and customer segments."
        actions={
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <RotateCcw />
            Reset Filters
          </Button>
        }
      />

      <FilterBar>
        <FacetPopover label="Country" options={COUNTRIES} selected={filters.countries} onToggle={(value) => toggleFacet('countries', value)} onClear={() => patch({ countries: [] })} />
        <FacetPopover label="Category" options={CATEGORIES} selected={filters.categories} onToggle={(value) => toggleFacet('categories', value)} onClear={() => patch({ categories: [] })} />
      </FilterBar>

      {snapshot && summary ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2">
          <span className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">Current Window</span>
          <Badge variant="neutral" size="sm">{presetLabel}</Badge>
          <Badge variant="neutral" size="sm">{formatCompact(summary.orders)} orders</Badge>
          <Badge variant="neutral" size="sm">{resolvedGranularity} granularity</Badge>
        </div>
      ) : null}

      {loadError ? (
        <ErrorState title="Delivery analytics unavailable" description={loadError} onRetry={() => setRetry((value) => value + 1)} />
      ) : !snapshot ? (
        <LoadingState />
      ) : !summary || !orders.length ? (
        <EmptyState
          icon={Package}
          title="No deliveries match these filters"
          description="Adjust the date range or remove a filter to restore delivery performance data."
          action={<Button variant="secondary" size="sm" onClick={clearAll}>Reset Filters</Button>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-md border border-line bg-surface p-3 shadow-hair">
                <div className="flex items-center gap-2 text-fg-subtle">{kpi.icon}<p className="text-2xs font-semibold uppercase tracking-[0.08em]">{kpi.label}</p></div>
                <p className="tnum mt-3 text-lg font-semibold tracking-tight text-fg">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel>
              <PanelHeader title="Delivery Performance Trend" description="On-time and late delivery rates for the selected period." />
              <PanelBody><TrendChart data={snapshot.series.map((point) => ({ ...point })) as Record<string, unknown>[]} series={trendSeries} height={260} leftFormat="percent" rightFormat="percent" rightDomain={[0, 100]} /></PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Late vs On-Time Deliveries" description="Delivery outcome mix within the current selection." />
              <PanelBody><DonutChart data={statusSplit} height={245} centerLabel="Deliveries" centerValue={formatCompact(summary.orders)} /></PanelBody>
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel>
              <PanelHeader title="Delivery Performance by Carrier" description="Late rate benchmarked against the filtered network average." />
              <PanelBody>
                <RankedBars
                  data={[...snapshot.carriers].sort((a, b) => b.lateRate - a.lateRate).map((row) => ({ label: row.name, value: row.lateRate, sublabel: `${formatNumber(row.orders)} orders · ${formatDays(row.avgDays)}`, color: row.lateRate > summary.lateRate ? SEMANTIC.danger : SEMANTIC.success }))}
                  format="percent" height={Math.max(280, snapshot.carriers.length * 34)} reference={summary.lateRate} referenceLabel="Network avg"
                />
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Delivery Performance by Shipping Method" description="Compare service-level reliability and transit time." />
              <PanelBody>
                <RankedBars
                  data={[...snapshot.methods].sort((a, b) => b.lateRate - a.lateRate).map((row) => ({ label: row.name, value: row.lateRate, sublabel: `${formatNumber(row.orders)} orders · ${formatDays(row.avgDays)}`, color: row.lateRate > summary.lateRate ? SEMANTIC.danger : SEMANTIC.success }))}
                  format="percent" height={Math.max(220, snapshot.methods.length * 38)} reference={summary.lateRate} referenceLabel="Network avg"
                />
              </PanelBody>
            </Panel>
          </div>

          <Panel>
            <PanelHeader title="Carrier Performance Details" description="Sortable service-level view of the filtered delivery population." />
            <PanelBody>
              <TableWrap maxHeight={440}>
                <THead>
                  <TR>
                    {([
                      ['name', 'Carrier'], ['orders', 'Orders'], ['lateRate', 'Late Rate'], ['onTimeRate', 'On-Time Rate'],
                      ['avgDays', 'Avg Days'], ['avgDelay', 'Avg Delay'], ['returnRate', 'Return Rate'],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <TH key={key} align={key === 'name' ? undefined : 'right'}>
                        <button type="button" onClick={() => setSort(key)} className={cn('font-semibold hover:text-fg', key !== 'name' && 'ml-auto')}>
                          {label} {sort.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
                        </button>
                      </TH>
                    ))}
                    <TH align="right">Cost / Order</TH>
                  </TR>
                </THead>
                <TBody>
                  {sortedCarrierRows.map((row) => (
                    <TR key={row.name}>
                      <TD className="font-medium text-fg">{row.name}</TD>
                      <TD align="right" className="tnum">{formatNumber(row.orders)}</TD>
                      <TD align="right" className={cn('tnum', row.lateRate > summary.lateRate ? 'text-danger' : 'text-success')}>{formatPercent(row.lateRate, 1)}</TD>
                      <TD align="right" className="tnum">{formatPercent(row.onTimeRate, 1)}</TD>
                      <TD align="right" className="tnum">{formatDays(row.avgDays)}</TD>
                      <TD align="right" className="tnum">{formatDays(row.avgDelay)}</TD>
                      <TD align="right" className="tnum">{formatPercent(row.returnRate, 1)}</TD>
                      <TD align="right" className="tnum">{formatCompactCurrency(row.costPerOrder)}</TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            </PanelBody>
          </Panel>
        </>
      )}
    </div>
  )
}
