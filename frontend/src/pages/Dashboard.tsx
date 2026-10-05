import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Clock3,
  Download,
  Gauge,
  Globe2,
  Lightbulb,
  PackageCheck,
  PackageOpen,
  Sparkles,
  TimerReset,
  TrendingDown,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { PageHeader, MetaItem } from '../components/layout/Topbar'
import { FilterBar, ActiveFilters, useFilters, resolveGranularity, DATE_PRESETS } from '../components/common/filter-bar'
import { KpiGrid, InsightCard, formatKpi } from '../components/common/tiles'
import { Panel, PanelBody, PanelHeader, PanelFooter, Section } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Segmented } from '../components/ui/controls'
import { Hint } from '../components/ui/tooltip'
import { useUrlState } from '../hooks/use-url-state'
import { exportCsv, stamp, toCsv } from '../services/export'
import {
  buildOverview,
  buildInsights,
  selectOrders,
  serviceStatusSplit,
  summarise,
  type Granularity,
} from '../services/analytics'
import { SEMANTIC } from '../components/charts/theme'
import { TrendChart } from '../components/charts/trend'
import { ColumnChart, RankedBars } from '../components/charts/bars'
import { DonutChart } from '../components/charts/radial'
import { formatCompact, formatCompactCurrency, formatNumber, formatPercent } from '../lib/format'
import { notify } from '../services/api'
import { cn } from '../lib/cn'

const KPI_ICONS: LucideIcon[] = [PackageOpen, TimerReset, CircleDollarSign, Gauge]

export default function DashboardPage() {
  const { filters, granularity, spanDays, setGranularity, patch } = useFilters()
  const [metric, setMetric] = useUrlState<'lateRate'|'orders'|'avgDays'|'shippingCost'|'revenue'|'onTimeRate'>('metric', 'lateRate')
  const resolvedGranularity: Granularity = resolveGranularity(granularity as Granularity, spanDays)

  const data = useMemo(
    () => buildOverview(filters, resolvedGranularity as Granularity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.from, filters.to, filters.carriers.join(), filters.warehouses.join(), filters.countries.join(), filters.segments.join(), filters.categories.join(), filters.shippingMethods.join(), resolvedGranularity],
  )

  const insights = useMemo(() => buildInsights(selectOrders({}), selectOrders(filters), filters), [filters])
  const summary = useMemo(() => summarise(selectOrders(filters)), [filters])

  const presetLabel = DATE_PRESETS.find((p) => p.days === spanDays)?.label

  const trendSeries = useMemo(() => {
    const map: Record<string, { key: string; label: string; color: string; axis?: 'left' | 'right'; dashed?: boolean }> = {
      orders: { key: 'orders', label: 'Orders', color: SEMANTIC.brand },
      lateRate: { key: 'lateRate', label: 'Late rate', color: SEMANTIC.danger, axis: 'right' },
      onTimeRate: { key: 'onTimeRate', label: 'On-time rate', color: SEMANTIC.success, axis: 'right' },
      avgDays: { key: 'avgDays', label: 'Avg transit', color: SEMANTIC.violet },
      shippingCost: { key: 'shippingCost', label: 'Shipping cost', color: SEMANTIC.teal },
      revenue: { key: 'revenue', label: 'Revenue', color: SEMANTIC.info },
    }
    return [map[metric] ?? map.lateRate]
  }, [metric])

  let leftFormat: 'compactCurrency' | 'days' | 'number' | 'percent' = 'percent'
  if (metric === 'shippingCost' || metric === 'revenue') leftFormat = 'compactCurrency'
  else if (metric === 'avgDays') leftFormat = 'days'
  else if (metric === 'orders') leftFormat = 'number'
  const trendFormat = { leftFormat, rightFormat: 'percent' } as const

  const topCarriers = data.carriers.slice(0, 8)
  const topWarehouses = data.warehouses.slice(0, 8)
  const topCountries = data.countries.slice(0, 10)

  const handleExport = () => {
    const rows = data.series.map((p) => ({
      period: p.fullLabel,
      orders: p.orders,
      on_time: p.onTime,
      late: p.late,
      late_rate_pct: p.lateRate.toFixed(2),
      avg_days: p.avgDays.toFixed(2),
      shipping_cost: p.shippingCost.toFixed(2),
      revenue: p.revenue.toFixed(2),
    }))
    exportCsv(stamp('logisense-network-overview'), toCsv(rows))
    notify.success('Export ready', `${formatNumber(rows.length)} periods written to CSV.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Activity className="size-3" />
            Network operations
          </>
        }
        title="Network Overview"
        description="Real-time health of the delivery network — service level, transit performance, spend and risk across every carrier, warehouse and lane."
        actions={
          <>
            <Hint label="Download the visible series as CSV">
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <Download />
                Export
              </Button>
            </Hint>
            <Button variant="primary" size="sm" asChild>
              <Link to="/orders">
                <Boxes />
                Explore orders
              </Link>
            </Button>
          </>
        }
        meta={
          <>
            <MetaItem label="Window" value={presetLabel ?? `${filters.from} → ${filters.to}`} />
            <MetaItem label="Rows in scope" value={formatCompact(summary.orders)} />
            <MetaItem label="Resolution" value={resolvedGranularity} />
            <MetaItem label="Generated" value={data.generatedAt} />
          </>
        }
      />

      <div className="space-y-2.5">
        <FilterBar>
          <Segmented
            size="sm"
            ariaLabel="Chart metric"
            value={metric}
            onChange={(v: string) => setMetric(v as any)}
            options={[
              { value: 'lateRate', label: 'Late rate' },
              { value: 'onTimeRate', label: 'On time' },
              { value: 'avgDays', label: 'Transit' },
              { value: 'orders', label: 'Volume' },
              { value: 'shippingCost', label: 'Cost' },
              { value: 'revenue', label: 'Revenue' },
            ]}
          />
        </FilterBar>
        <ActiveFilters />
      </div>

      <KpiGrid kpis={data.kpis} icons={KPI_ICONS} />

      {/* Primary trend + service split */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Network performance over time"
            description={`${resolvedGranularity} resolution · ${presetLabel ?? 'custom window'}`}
            icon={<TrendingDown />}
            actions={
              <Segmented
                size="sm"
                ariaLabel="Granularity"
                value={granularity}
                onChange={(v: string) => setGranularity(v as any)}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'day', label: 'D' },
                  { value: 'week', label: 'W' },
                  { value: 'month', label: 'M' },
                ]}
              />
            }
          />
          <PanelBody>
            <TrendChart
              data={data.series as unknown as Record<string, unknown>[]}
              series={trendSeries}
              height={300}
              {...trendFormat}
              reference={metric === 'lateRate' ? { value: summary.lateRate, label: 'Window avg', axis: 'right' } : undefined}
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Service status mix"
            description="Operational state of every shipment in scope"
            icon={<PackageCheck />}
          />
          <PanelBody className="space-y-4">
            <DonutChart
              data={serviceStatusSplit(selectOrders(filters))}
              height={186}
              centerValue={formatPercent(summary.onTimeRate)}
              centerLabel="On time"
              format="percent"
            />
            <dl className="grid grid-cols-3 gap-2 border-t border-line-soft pt-3.5">
              {[
                { label: 'Avg transit', value: formatKpi(summary.avgDays, 'days') },
                { label: 'Avg distance', value: formatNumber(summary.avgDistance) },
                { label: 'Return rate', value: formatPercent(summary.returnRate, 1) },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-2xs text-fg-subtle">{s.label}</dt>
                  <dd className="tnum mt-0.5 text-[15px] font-semibold tracking-[-0.02em] text-fg">{s.value}</dd>
                </div>
              ))}
            </dl>
          </PanelBody>
        </Panel>
      </div>

      {/* Rankings */}
      <Section
        title="Rankings"
        description="Where performance and cost are concentrated. Click a row to scope the rest of the workspace."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel>
            <PanelHeader title="Carriers" description="By order volume" icon={<Truck />} compact />
            <PanelBody className="pt-3">
              <RankedBars
                data={topCarriers.map((c) => ({
                  label: c.name,
                  value: c.orders,
                  sublabel: `${formatPercent(c.lateRate, 1)} late`,
                }))}
                format="compact"
                labelWidth={92}
                onSelect={(label) => patch({ carriers: [label] })}
              />
            </PanelBody>
            <PanelFooter>
              <Link
                to="/carrier-analytics"
                className="inline-flex items-center gap-1 text-2xs text-fg-subtle transition-colors hover:text-fg"
              >
                Carrier analytics <ArrowRight className="size-3" />
              </Link>
              <span className="tnum text-2xs text-fg-subtle">{data.carriers.length} carriers</span>
            </PanelFooter>
          </Panel>

          <Panel>
            <PanelHeader title="Warehouses" description="Late rate, worst first" icon={<Boxes />} compact />
            <PanelBody className="pt-3">
              <RankedBars
                data={[...topWarehouses]
                  .sort((a, b) => b.lateRate - a.lateRate)
                  .map((w) => ({
                    label: w.name,
                    value: w.lateRate,
                    sublabel: `${formatNumber(w.orders)} orders`,
                    color: w.lateRate > 55 ? SEMANTIC.danger : w.lateRate > 45 ? SEMANTIC.warning : SEMANTIC.success,
                  }))}
                format="percent"
                max={100}
                labelWidth={104}
                onSelect={(label) => {
                  const hit = label.split(' · ')[0]
                  patch({ warehouses: [hit] })
                }}
              />
            </PanelBody>
            <PanelFooter>
              <Link
                to="/olap"
                className="inline-flex items-center gap-1 text-2xs text-fg-subtle transition-colors hover:text-fg"
              >
                Slice the cube <ArrowRight className="size-3" />
              </Link>
              <span className="tnum text-2xs text-fg-subtle">{data.warehouses.length} sites</span>
            </PanelFooter>
          </Panel>

          <Panel>
            <PanelHeader title="Destinations" description="Top 10 by volume" icon={<Globe2 />} compact />
            <PanelBody className="pt-3">
              <RankedBars
                data={topCountries.map((c) => ({
                  label: c.country,
                  value: c.orders,
                  sublabel: `${c.avgDays.toFixed(1)} d avg`,
                }))}
                format="compact"
                labelWidth={96}
              />
            </PanelBody>
            <PanelFooter>
              <span className="text-2xs text-fg-subtle">
                {formatCompact(summary.avgDistance)} km average lane length
              </span>
              <span className="tnum text-2xs text-fg-subtle">{data.countries.length} countries</span>
            </PanelFooter>
          </Panel>
        </div>
      </Section>

      {/* Volume + mix */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Orders and exceptions by period"
            description="Stacked volume — delivered on time against delayed and returned"
            icon={<Clock3 />}
          />
          <PanelBody>
            <ColumnChart
              data={data.series as unknown as Record<string, unknown>[]}
              series={[
                { key: 'onTime', label: 'On time', color: SEMANTIC.success },
                { key: 'late', label: 'Late', color: SEMANTIC.danger },
              ]}
              format="compact"
              height={266}
              stacked
            />
          </PanelBody>
        </Panel>

        <div className="grid gap-4">
          <Panel>
            <PanelHeader title="Product categories" description="Late rate by category" compact />
            <PanelBody className="pt-3">
              <RankedBars
                data={data.categories.map((c) => ({
                  label: c.name,
                  value: c.lateRate,
                  sublabel: `${formatCompact(c.orders)} orders`,
                }))}
                format="percent"
                max={Math.max(...data.categories.map((c) => c.lateRate), 1)}
                labelWidth={112}
                onSelect={(label) => patch({ categories: [label] })}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Customer segments" description="Spend and service mix" compact />
            <PanelBody className="space-y-3 pt-3">
              {data.segments.map((s) => (
                <div key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] text-fg-secondary">{s.name}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(s.orders / Math.max(...data.segments.map((x) => x.orders), 1)) * 100}%`,
                          backgroundColor: SEMANTIC.brand,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-[12px] font-medium text-fg">{formatCompactCurrency(s.revenue)}</p>
                    <p className={cn('tnum text-2xs', s.lateRate > 50 ? 'text-danger-fg' : 'text-fg-subtle')}>
                      {formatPercent(s.lateRate, 1)} late
                    </p>
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>
        </div>
      </div>

      {/* Insights */}
      <Section
        title="Automated insights"
        description="Derived from the same fact rows as every chart on this page — no separate pipeline."
        actions={
          <Hint label="Insights are recomputed on every filter change">
            <span className="inline-flex items-center gap-1.5 text-2xs text-fg-subtle">
              <Sparkles className="size-3" />
              {insights.length} findings
            </span>
          </Hint>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {insights.map((insight, i) => (
            <InsightCard key={insight.id} insight={insight} index={i} />
          ))}
        </div>
      </Section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-2xs text-fg-subtle">
        <span className="inline-flex items-center gap-1.5">
          <Lightbulb className="size-3" />
          Figures reconcile to the {formatNumber(data.totalOrders)}-row delivery fact table.
        </span>
        <span>
          {presetLabel ?? 'Custom window'} · {resolvedGranularity} buckets · {formatNumber(summary.orders)} orders in scope
        </span>
      </footer>
    </div>
  )
}