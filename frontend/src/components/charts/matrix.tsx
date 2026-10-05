import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DefaultTooltip } from './tooltip'
import { AXIS, SEMANTIC, SERIES } from './theme'
import { formatters, type FormatterKey } from './bars'
import { cn } from '../../lib/cn'

/* ------------------------------------------------------------------ *
 * Heatmap — dense matrix (lane × weekday, carrier × country, …)
 * ------------------------------------------------------------------ */

export interface HeatmapProps {
  rows: readonly string[]
  columns: readonly string[]
  /** `cells[rowIndex][columnIndex]` */
  cells: readonly (readonly number[])[]
  format?: FormatterKey
  rowLabel?: string
  /** Perceptual ceiling for the colour ramp. */
  max?: number
  /** Two-sided ramp: negative values diverge below zero. */
  diverging?: boolean
  /** Hard colour cut-offs evaluated in order, e.g. [0.25,'danger'], [0.5,'warning']. */
  thresholds?: readonly (readonly [number, string])[]
  cellHeight?: number
  className?: string
  emptyLabel?: string
}

export function Heatmap({
  rows,
  columns,
  cells,
  format = 'percent',
  rowLabel = '',
  max,
  diverging = false,
  thresholds,
  cellHeight = 30,
  className,
  emptyLabel = 'No data',
}: HeatmapProps) {
  if (!rows.length || !columns.length) {
    return <p className="py-10 text-center text-xs text-fg-subtle">{emptyLabel}</p>
  }

  const peak = max ?? Math.max(...cells.flat().map((v) => Math.abs(v)), 0.0001)
  const fmt = formatters[format]

  return (
    <div className={cn('scrollbar-thin overflow-auto', className)}>
      <table className="w-full border-separate border-spacing-[2px] text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface pb-1 pl-1 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-fg-subtle">
              {rowLabel}
            </th>
            {columns.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-1 pb-1 text-center text-[10px] font-medium uppercase tracking-[0.05em] text-fg-subtle"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}>
              <th
                scope="row"
                className="sticky left-0 z-10 max-w-[124px] truncate bg-surface py-1 pl-1 pr-2 text-left text-[11px] font-medium text-fg-secondary"
              >
                {r}
              </th>
              {columns.map((c, j) => {
                const v = cells[i]?.[j] ?? 0
                const cut = thresholds?.find(([limit]) => v >= limit)
                const base =
                  cut?.[1] ??
                  (diverging ? (v < 0 ? SEMANTIC.danger : SEMANTIC.success) : SEMANTIC.brand)
                const t = Math.min(1, Math.abs(v) / Math.max(peak, 0.0001))
                return (
                  <td
                    key={c}
                    title={`${r} · ${c} — ${fmt(v)}`}
                    style={{
                      height: cellHeight,
                      backgroundColor: `color-mix(in oklab, ${base} ${Math.round(8 + t * 52)}%, transparent)`,
                    }}
                    className="tnum rounded-[3px] px-1 text-center font-medium text-fg transition-[outline-color] hover:outline hover:outline-1 hover:outline-line-strong"
                  >
                    {fmt(v)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Waterfall — contribution bridge (spend by carrier, variance drivers)
 * ------------------------------------------------------------------ */

export interface WaterfallStep {
  label: string
  value: number
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'teal'
  /** Render as an absolute total rather than a delta. */
  total?: boolean
}

export function Waterfall({
  steps,
  totalLabel = 'Net',
  format = 'currency',
  max,
  className,
  showAxis = true,
}: {
  steps: readonly WaterfallStep[]
  totalLabel?: string
  format?: FormatterKey
  max?: number
  className?: string
  showAxis?: boolean
}) {
  if (!steps.length) {
    return <p className="py-10 text-center text-xs text-fg-subtle">No contributions to display</p>
  }

  const fmt = formatters[format]
  const rows: { label: string; from: number; to: number; value: number; tone: string; total: boolean }[] = []
  let running = 0
  for (const step of steps) {
    if (step.total) {
      rows.push({ label: step.label, from: 0, to: step.value, value: step.value, tone: step.tone ?? 'info', total: true })
      running = step.value
    } else {
      rows.push({ label: step.label, from: running, to: running + step.value, value: step.value, tone: step.tone ?? 'brand', total: false })
      running += step.value
    }
  }
  if (totalLabel && !steps.some((s) => s.total)) {
    rows.push({ label: totalLabel, from: 0, to: running, value: running, tone: 'teal', total: true })
  }

  const ceiling = max ?? Math.max(...rows.map((r) => Math.max(Math.abs(r.from), Math.abs(r.to))), 0.0001)

  return (
    <div className={cn('flex gap-4', className)}>
      <div className="min-w-0 flex-1 space-y-[3px]">
        {rows.map((r) => {
          const left = (Math.min(r.from, r.to) / ceiling) * 100
          const width = Math.max((Math.abs(r.to - r.from) / ceiling) * 100, 1.2)
          const color = SEMANTIC[r.tone as keyof typeof SEMANTIC] ?? SEMANTIC.brand
          return (
            <div key={r.label} className="group grid grid-cols-[minmax(0,110px)_minmax(0,1fr)_64px] items-center gap-3">
              <span
                className={cn(
                  'truncate text-[11.5px]',
                  r.total ? 'font-semibold text-fg' : 'text-fg-secondary',
                )}
              >
                {r.label}
              </span>
              <span className="relative h-[18px] overflow-hidden rounded-[3px] bg-surface-sunken">
                <span
                  className="absolute inset-y-0 rounded-[3px] transition-[left,width] duration-500"
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
                />
                {!r.total ? (
                  <span
                    className="absolute inset-y-[6px] w-px bg-line-strong"
                    style={{ left: `${(r.from / ceiling) * 100}%` }}
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  'tnum text-right text-[11.5px] font-medium',
                  r.total ? 'text-fg' : r.value < 0 ? 'text-danger' : 'text-fg-muted',
                )}
              >
                {r.total ? '' : r.value > 0 ? '+' : ''}
                {fmt(r.value)}
              </span>
            </div>
          )
        })}
      </div>
      {showAxis ? (
        <div className="hidden w-[92px] shrink-0 space-y-[3px] sm:block">
          <p className="text-[10px] uppercase tracking-[0.06em] text-fg-subtle">Scale</p>
          {[1, 0.75, 0.5, 0.25, 0].map((t) => (
            <p
              key={t}
              className="tnum flex h-[18px] items-center border-b border-line-soft text-[10px] text-fg-subtle"
            >
              {fmt(ceiling * t)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Line compare — 2–4 series sharing one axis
 * ------------------------------------------------------------------ */

export interface LineCompareSeries {
  key: string
  label: string
  color?: string
  dashed?: boolean
  area?: boolean
}

export function LineCompare<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  format = 'percent',
  yFormat,
  height = 260,
  showLegend = true,
  reference,
  className,
  markLast = false,
}: {
  data: readonly T[]
  xKey: string
  series: readonly LineCompareSeries[]
  format?: FormatterKey
  yFormat?: FormatterKey
  height?: number
  showLegend?: boolean
  reference?: { label: string; value: number }
  className?: string
  markLast?: boolean
}) {
  if (!data.length) {
    return <p className="py-10 text-center text-xs text-fg-subtle">No series to compare</p>
  }

  const fmt = formatters[format]
  const yFmt = formatters[yFormat ?? format]

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data as Record<string, unknown>[]} margin={{ top: 8, right: 10, bottom: 0, left: -14 }}>
          <CartesianGrid {...AXIS.grid} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={AXIS.tick}
            tickLine={false}
            axisLine={AXIS.axis}
            minTickGap={16}
            tickFormatter={(v: string) => (typeof v === 'string' && v.length > 10 ? v.slice(0, 10) : v)}
          />
          <YAxis
            tick={AXIS.tick}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(v: number) => yFmt(v)}
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-line-strong)', strokeWidth: 1 }}
            content={
              <DefaultTooltip
                format={(v, name) => {
                  const spec = series.find((s) => s.label === name || s.key === name)
                  return formatters[spec?.key ? format : format](v)
                }}
              />
            }
          />
          {reference ? (
            <ReferenceLine
              y={reference.value}
              stroke={SEMANTIC.warning}
              strokeDasharray="4 3"
              strokeWidth={1}
              label={{ value: reference.label, position: 'right', fill: 'var(--color-fg-subtle)', fontSize: 10 }}
            />
          ) : null}
          {series.map((s, i) => {
            const color = s.color ?? SERIES[i % SERIES.length]
            if (s.area) {
              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={color}
                  strokeWidth={1.8}
                  fill={color}
                  fillOpacity={0.08}
                  strokeDasharray={s.dashed ? '4 3' : undefined}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 3, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                />
              )
            }
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={1.8}
                strokeDasharray={s.dashed ? '4 3' : undefined}
                dot={markLast}
                isAnimationActive={false}
                activeDot={{ r: 3, strokeWidth: 2, stroke: 'var(--color-surface)' }}
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>

      {showLegend ? (
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5 text-[11px] text-fg-secondary">
              <span
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: s.color ?? SERIES[i % SERIES.length] }}
              />
              {s.label}
              <span className="tnum text-fg-subtle">
                {fmt(Number((data[data.length - 1] as Record<string, unknown>)[s.key]))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Diverging bar — positive / negative contributions side by side
 * ------------------------------------------------------------------ */

export function DivergingBars({
  data,
  xKey,
  yKey,
  height = 220,
  format = 'percent',
  positiveTone = 'success',
  negativeTone = 'danger',
}: {
  data: readonly { label: string; value: number }[]
  xKey: keyof { label: string; value: number }
  yKey: keyof { label: string; value: number }
  height?: number
  format?: FormatterKey
  positiveTone?: keyof typeof SEMANTIC
  negativeTone?: keyof typeof SEMANTIC
}) {
  if (!data.length) {
    return <p className="py-10 text-center text-xs text-fg-subtle">No data</p>
  }

  const fmt = formatters[format]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data as unknown as Record<string, unknown>[]}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
        barCategoryGap="26%"
      >
        <CartesianGrid {...AXIS.grid} vertical horizontal={false} />
        <XAxis type="number" tick={AXIS.tick} tickLine={false} axisLine={false} tickFormatter={fmt} />
        <YAxis
          type="category"
          dataKey={xKey as string}
          tick={AXIS.tick}
          tickLine={false}
          axisLine={false}
          width={132}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-surface-sunken)' }}
          content={<DefaultTooltip format={(v) => fmt(v)} />}
        />
        <Bar dataKey={yKey as string} isAnimationActive={false} radius={2}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.value < 0 ? SEMANTIC[negativeTone] : SEMANTIC[positiveTone]}
              fillOpacity={0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}