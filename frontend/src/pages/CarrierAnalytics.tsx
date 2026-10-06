import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Award, CalendarDays, CheckCircle2, Clock3, DollarSign, Package, RotateCcw, Star, Undo2 } from 'lucide-react'
import { PageHeader } from '../components/layout/Topbar'
import { DATE_PRESETS, FilterBar, resolveGranularity, useFilters } from '../components/common/filter-bar'
import { Panel, PanelBody, PanelHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Checkbox } from '../components/ui/toggle'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { EmptyState, ErrorState } from '../components/ui/states'
import { TableWrap, TBody, TD, TH, THead, TR } from '../components/ui/table'
import { ColumnChart } from '../components/charts/bars'
import { TrendChart } from '../components/charts/trend'
import { SEMANTIC } from '../components/charts/theme'
import { CATEGORIES, COUNTRIES } from '../lib/warehouse'
import { formatCurrency, formatDays, formatNumber, formatPercent } from '../lib/format'
import { cn } from '../lib/cn'
import { rankBy, selectOrders, summarise, timeSeries, type Granularity, type Summary } from '../services/analytics'
import type { Filters, RankRow, TimePoint } from '../types'

type SortKey =
  | 'name'
  | 'orders'
  | 'onTimeRate'
  | 'lateRate'
  | 'avgDays'
  | 'avgDelay'
  | 'costPerOrder'
  | 'avgRating'
  | 'returnRate'

interface CarrierRow extends RankRow {
  avgDelay: number
  score: number
}

interface CarrierSnapshot {
  summary: Summary
  series: TimePoint[]
  carriers: CarrierRow[]
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
            <label key={option} className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5 hover:bg-surface-hover">
              <Checkbox checked={selected.includes(option)} onCheckedChange={() => onToggle(option)} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg-secondary">{option}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function performanceScore(row: RankRow, avgDelay: number): number {
  // Derived score only: 60% on-time rate, 20% inverse delay (10-day cap), 20% rating.
  return Math.round((row.onTimeRate * 0.6 + (1 - Math.min(avgDelay / 10, 1)) * 20 + (row.avgRating / 5) * 20) * 10) / 10
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-live="polite" aria-label="Loading carrier analytics">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[98px] animate-pulse rounded-md border border-line bg-surface-sunken" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-[320px] animate-pulse rounded-lg border border-line bg-surface-sunken" />)}
      </div>
    </div>
  )
}

export default function CarrierAnalytics() {
  const { filters, granularity, spanDays, clearAll, patch } = useFilters()
  const resolvedGranularity: Granularity = resolveGranularity(granularity as Granularity, spanDays)
  const [snapshot, setSnapshot] = useState<CarrierSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [sort, setSortState] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'onTimeRate', direction: 'desc' })

  const filterKey = [
    filters.from, filters.to, filters.carriers.join(','), filters.warehouses.join(','), filters.countries.join(','),
    filters.segments.join(','), filters.categories.join(','), filters.shippingMethods.join(','), resolvedGranularity, retry,
  ].join('|')

  useEffect(() => {
    let cancelled = false
    setSnapshot(null)
    setError(null)
    const frame = window.requestAnimationFrame(() => {
      try {
        const orders = selectOrders(filters)
        const carriers = rankBy(orders, (order) => order.carrier).map((row) => {
          const carrierOrders = orders.filter((order) => order.carrier === row.name)
          const avgDelay = summarise(carrierOrders).avgDelay
          return { ...row, avgDelay, score: performanceScore(row, avgDelay) }
        })
        if (!cancelled) {
          setSnapshot({
            summary: summarise(orders),
            series: timeSeries(orders, resolvedGranularity),
            carriers,
          })
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'The carrier data could not be read.')
      }
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [filterKey])

  const toggleFacet = (key: 'countries' | 'categories', value: string) => {
    const selected = filters[key]
    patch({ [key]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] } as Partial<Filters>)
  }

  const sortedCarriers = useMemo(() => {
    if (!snapshot) return []
    return [...snapshot.carriers].sort((left, right) => {
      const a = left[sort.key]
      const b = right[sort.key]
      const result = typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : Number(a) - Number(b)
      return sort.direction === 'asc' ? result : -result
    })
  }, [snapshot, sort])

  const setSort = (key: SortKey) => {
    setSortState((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'name' ? 'asc' : 'desc' })
  }

  const summary = snapshot?.summary
  const selectedCarrierLabel = filters.carriers.length
    ? filters.carriers.join(', ')
    : 'All carriers'
  const presetLabel = DATE_PRESETS.find((preset) => preset.days === spanDays)?.label ?? `${filters.from} → ${filters.to}`

  const kpis = summary ? [
    { label: 'Total Orders', value: formatNumber(summary.orders), icon: <Package className="size-4 text-brand" /> },
    { label: 'On-Time Rate', value: formatPercent(summary.onTimeRate, 1), icon: <CheckCircle2 className="size-4 text-success" /> },
    { label: 'Late Rate', value: formatPercent(summary.lateRate, 1), icon: <AlertTriangle className="size-4 text-danger" /> },
    { label: 'Avg Delivery Days', value: formatDays(summary.avgDays), icon: <CalendarDays className="size-4 text-info" /> },
    { label: 'Avg Delay Days', value: formatDays(summary.avgDelay), icon: <Clock3 className="size-4 text-warning" /> },
    { label: 'Avg Shipping Cost', value: formatCurrency(summary.orders ? summary.shippingCost / summary.orders : 0, true), icon: <DollarSign className="size-4 text-teal" /> },
    { label: 'Average Rating', value: `${summary.avgRating.toFixed(2)} / 5`, icon: <Star className="size-4 text-warning" /> },
    { label: 'Return Rate', value: formatPercent(summary.returnRate, 1), icon: <Undo2 className="size-4 text-violet" /> },
  ] : []

  const chartRows = snapshot?.carriers ?? []
  const comparisonData = chartRows.map((row) => ({ label: row.name, onTime: row.onTimeRate, late: row.lateRate }))
  const deliveryTimeData = chartRows.map((row) => ({ label: row.name, value: row.avgDays }))
  const shippingCostData = chartRows.map((row) => ({ label: row.name, value: row.costPerOrder }))
  const trendSeries = [
    { key: 'onTimeRate', label: 'On-time rate', color: SEMANTIC.success, axis: 'right' as const, format: 'percent' as const },
    { key: 'lateRate', label: 'Late rate', color: SEMANTIC.danger, axis: 'right' as const, format: 'percent' as const },
  ]

  const best = chartRows.reduce<CarrierRow | null>((current, row) => !current || row.score > current.score ? row : current, null)
  const attention = chartRows.reduce<CarrierRow | null>((current, row) => !current || row.score < current.score ? row : current, null)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Carrier Analytics"
        description="Compare carrier reliability, transit time, cost and customer outcomes across the delivery network."
        actions={<Button variant="ghost" size="sm" onClick={clearAll}><RotateCcw />Reset Filters</Button>}
      />

      <FilterBar>
        <FacetPopover label="Country" options={COUNTRIES} selected={filters.countries} onToggle={(value) => toggleFacet('countries', value)} onClear={() => patch({ countries: [] })} />
        <FacetPopover label="Category" options={CATEGORIES} selected={filters.categories} onToggle={(value) => toggleFacet('categories', value)} onClear={() => patch({ categories: [] })} />
      </FilterBar>

      {snapshot && summary ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2">
          <span className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">Carrier Scope</span>
          <Badge variant="brand" size="sm">{selectedCarrierLabel}</Badge>
          <Badge variant="neutral" size="sm">{presetLabel}</Badge>
          <Badge variant="neutral" size="sm">{formatNumber(summary.orders)} orders</Badge>
          <Badge variant="neutral" size="sm">{resolvedGranularity} trend</Badge>
        </div>
      ) : null}

      {error ? (
        <ErrorState title="Carrier analytics unavailable" description={error} onRetry={() => setRetry((value) => value + 1)} />
      ) : !snapshot ? (
        <LoadingState />
      ) : !summary || !summary.orders ? (
        <EmptyState icon={Package} title="No carrier deliveries match these filters" description="Adjust the date range or remove a filter to restore carrier performance data." action={<Button variant="secondary" size="sm" onClick={clearAll}>Reset Filters</Button>} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-md border border-line bg-surface p-3 shadow-hair">
                <div className="flex items-center gap-2 text-fg-subtle">{kpi.icon}<p className="text-2xs font-semibold uppercase tracking-[0.08em]">{kpi.label}</p></div>
                <p className="tnum mt-3 text-lg font-semibold tracking-tight text-fg">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel tone="accent">
              <PanelBody className="flex items-start gap-3">
                <Award className="mt-0.5 size-5 shrink-0 text-brand" />
                <div><p className="text-2xs font-semibold uppercase tracking-[0.1em] text-brand">Best Performing Carrier</p><p className="mt-1 text-base font-semibold text-fg">{best?.name ?? '—'}</p><p className="mt-1 text-xs text-fg-muted">{best ? `${best.score.toFixed(1)} performance score · ${formatPercent(best.onTimeRate, 1)} on-time · ${formatDays(best.avgDelay)} average delay` : 'No carrier comparison available.'}</p></div>
              </PanelBody>
            </Panel>
            <Panel tone="sunken">
              <PanelBody className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
                <div><p className="text-2xs font-semibold uppercase tracking-[0.1em] text-danger">Needs Attention</p><p className="mt-1 text-base font-semibold text-fg">{attention?.name ?? '—'}</p><p className="mt-1 text-xs text-fg-muted">{attention ? `${attention.score.toFixed(1)} performance score · ${formatPercent(attention.lateRate, 1)} late · ${formatDays(attention.avgDays)} average delivery time` : 'No carrier comparison available.'}</p></div>
              </PanelBody>
            </Panel>
          </div>
          <p className="text-2xs text-fg-subtle">Performance score formula: 60% on-time rate + 20% inverse average delay (capped at 10 days) + 20% average rating.</p>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel>
              <PanelHeader title="Carrier On-Time vs Late Delivery" description="Reliability comparison for carriers in the current filtered population." />
              <PanelBody><ColumnChart data={comparisonData} series={[{ key: 'onTime', label: 'On-time rate', color: SEMANTIC.success, format: 'percent' }, { key: 'late', label: 'Late rate', color: SEMANTIC.danger, format: 'percent' }]} format="percent" yDomain={[0, 100]} height={300} /></PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Carrier Performance Trend" description="On-time and late rates over the selected date range." />
              <PanelBody><TrendChart data={snapshot.series.map((point) => ({ ...point })) as Record<string, unknown>[]} series={trendSeries} height={300} leftFormat="percent" rightFormat="percent" rightDomain={[0, 100]} /></PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Average Delivery Time by Carrier" />
              <PanelBody><ColumnChart data={deliveryTimeData} series={[{ key: 'value', label: 'Average delivery days', color: SEMANTIC.info, format: 'days' }]} format="days" height={280} /></PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Average Shipping Cost by Carrier" description="Average shipping cost per order, derived from shipping cost and order count." />
              <PanelBody><ColumnChart data={shippingCostData} series={[{ key: 'value', label: 'Average shipping cost', color: SEMANTIC.teal, format: 'currency' }]} format="currency" height={280} /></PanelBody>
            </Panel>
          </div>

          <Panel>
            <PanelHeader title="Carrier Comparison" description="Sortable carrier-level metrics for the filtered delivery population." />
            <PanelBody>
              <TableWrap maxHeight={460}>
                <THead>
                  <TR>
                    {([
                      ['name', 'Carrier'], ['orders', 'Orders'], ['onTimeRate', 'On-time rate'], ['lateRate', 'Late rate'],
                      ['avgDays', 'Avg delivery days'], ['avgDelay', 'Avg delay'], ['costPerOrder', 'Avg shipping cost'],
                      ['avgRating', 'Avg rating'], ['returnRate', 'Return rate'],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <TH key={key} align={key === 'name' ? 'left' : 'right'} sortable sorted={sort.key === key ? sort.direction : null} onSort={() => setSort(key)}>{label}</TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {sortedCarriers.map((row) => (
                    <TR key={row.name}>
                      <TD className="font-medium text-fg">{row.name}</TD>
                      <TD align="right" className="tnum">{formatNumber(row.orders)}</TD>
                      <TD align="right" className="tnum text-success">{formatPercent(row.onTimeRate, 1)}</TD>
                      <TD align="right" className="tnum text-danger">{formatPercent(row.lateRate, 1)}</TD>
                      <TD align="right" className="tnum">{formatDays(row.avgDays)}</TD>
                      <TD align="right" className="tnum">{formatDays(row.avgDelay)}</TD>
                      <TD align="right" className="tnum">{formatCurrency(row.costPerOrder, true)}</TD>
                      <TD align="right" className="tnum">{row.avgRating.toFixed(2)}</TD>
                      <TD align="right" className="tnum">{formatPercent(row.returnRate, 1)}</TD>
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
