import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SEMANTIC } from './theme'
import { ChartFrame, axisLine, axisTick, gridLine } from './primitives'
import { ChartTooltipShell, TooltipRow, TooltipTitle } from './tooltip'
import { formatCompactCurrency, formatNumber, formatPercent } from '../../lib/format'

export type ValueFormatter = (value: number) => string

export const formatters = {
  percent: (v: number) => formatPercent(v, 1),
  percent0: (v: number) => formatPercent(v, 0),
  days: (v: number) => `${v.toFixed(2)} d`,
  number: (v: number) => formatNumber(v, 0),
  compact: (v: number) => formatNumber(v, 0),
  currency: (v: number) => `$${formatNumber(v, 0)}`,
  compactCurrency: (v: number) => formatCompactCurrency(v),
  km: (v: number) => `${formatNumber(v, 0)} km`,
  rating: (v: number) => v.toFixed(2),
} satisfies Record<string, ValueFormatter>

export type FormatterKey = keyof typeof formatters

/* ------------------------------------------------------------------ *
 * RankedBars — the horizontal bar chart.
 *
 * Sorted descending, single accent colour with optional per-row tint and a
 * benchmark reference line so the comparison is immediately legible.
 * ------------------------------------------------------------------ */

export interface RankedBarRow {
  label: string
  value: number
  sublabel?: string
  color?: string
}

export function RankedBars({
  data,
  format = 'percent',
  height,
  max,
  reference,
  referenceLabel,
  onSelect,
  activeLabel,
  labelWidth = 128,
  showValues = true,
  barSize = 18,
}: {
  data: readonly RankedBarRow[]
  format?: FormatterKey
  height?: number
  max?: number
  reference?: number
  referenceLabel?: string
  onSelect?: (label: string) => void
  activeLabel?: string | null
  labelWidth?: number
  showValues?: boolean
  barSize?: number
}) {
  const fmt = formatters[format]
  const rowH = 30
  const chartHeight = height ?? Math.max(140, data.length * rowH + 34)

  if (!data.length) return <ChartFrame height={chartHeight} empty />

  return (
    <ChartFrame height={chartHeight}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data as RankedBarRow[]}
          layout="vertical"
          margin={{ top: 4, right: showValues ? 56 : 12, bottom: 4, left: 0 }}
          barCategoryGap={6}
        >
          <CartesianGrid {...gridLine} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, max ?? 'auto']}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickCount={5}
            tickFormatter={(v: number) => fmt(v)}
          />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={axisLine}
            tickLine={false}
            width={labelWidth}
            interval={0}
            tick={(props: any) => {
              const v = String(props.payload?.value ?? '')
              const active = activeLabel === v
              const x = (Number(props.x)||0)-8, y = Number(props.y)||0
              return (
                <text x={x} y={y} textAnchor="end" dominantBaseline="middle" fill={active ? 'var(--color-fg)' : 'var(--color-fg-secondary)'} fontWeight={active ? 600 : 450} fontSize={11.5}>
                  {v.length > 19 ? `${v.slice(0, 18)}…` : v}
                </text>
              )
            }}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-hover)' }}
            wrapperStyle={{ outline: 'none' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0]?.payload as RankedBarRow
              return (
                <ChartTooltipShell>
                  <TooltipTitle>{row.label}</TooltipTitle>
                  <TooltipRow label="Value" value={fmt(row.value)} color={row.color ?? SEMANTIC.brand} strong />
                  {row.sublabel ? (
                    <p className="mt-1.5 border-t border-line-soft pt-1.5 text-2xs text-fg-subtle">
                      {row.sublabel}
                    </p>
                  ) : null}
                </ChartTooltipShell>
              )
            }}
          />
          {reference !== undefined ? (
            <ReferenceLine
              x={reference}
              stroke="var(--color-fg-subtle)"
              strokeDasharray="4 4"
              label={
                referenceLabel
                  ? { value: referenceLabel, position: 'top', fill: 'var(--color-fg-subtle)', fontSize: 10 }
                  : undefined
              }
            />
          ) : null}
          <Bar
            dataKey="value"
            radius={[0, 3, 3, 0]}
            barSize={barSize}
            isAnimationActive={false}
            onClick={(d: unknown) => {
              const row = d as RankedBarRow
              if (row?.label) onSelect?.(row.label)
            }}
            className={onSelect ? 'cursor-pointer' : undefined}
          >
            {data.map((row) => (
              <Cell
                key={row.label}
                fill={row.color ?? SEMANTIC.brand}
                fillOpacity={activeLabel && activeLabel !== row.label ? 0.38 : 1}
              />
            ))}
            {showValues ? (
              <LabelList
                dataKey="value"
                position="right"
                offset={8}
                formatter={(v: unknown) => fmt(Number(v))}
                style={{
                  fontSize: 11.5,
                  fill: 'var(--color-fg)',
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
            ) : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ------------------------------------------------------------------ *
 * ColumnChart — vertical grouped / stacked columns.
 * ------------------------------------------------------------------ */

export function ColumnChart({
  data,
  series,
  format = 'percent',
  height = 260,
  stacked = false,
  max,
  yDomain,
  onSelect,
  activeLabel,
  xInterval = 0,
}: {
  data: readonly Record<string, unknown>[]
  series: { key: string; label: string; color?: string; format?: FormatterKey }[]
  format?: FormatterKey
  height?: number
  stacked?: boolean
  max?: number
  yDomain?: [number | 'auto', number | 'auto']
  onSelect?: (label: string) => void
  activeLabel?: string | null
  xInterval?: number
}) {
  const primary = formatters[series[0]?.format ?? format]

  return (
    <ChartFrame height={height} empty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data as Record<string, unknown>[]}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barGap={stacked ? 0 : 2}
        >
          <CartesianGrid {...gridLine} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            axisLine={axisLine}
            tickLine={false}
            interval={xInterval}
            dy={4}
          />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={yDomain ?? [0, max ?? 'auto']}
            tickFormatter={(v: number) => primary(v)}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-hover)' }}
            wrapperStyle={{ outline: 'none' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <ChartTooltipShell>
                  <TooltipTitle>{String(label)}</TooltipTitle>
                  {series.map((s) => {
                    const fmt = formatters[s.format ?? format]
                    const row = payload.find((p) => p.dataKey === s.key)
                    return (
                      <TooltipRow
                        key={s.key}
                        label={s.label}
                        value={fmt(Number(row?.value ?? 0))}
                        color={s.color ?? SEMANTIC.brand}
                      />
                    )
                  })}
                </ChartTooltipShell>
              )
            }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? 'a' : undefined}
              fill={s.color ?? SEMANTIC.brand}
              radius={
                stacked
                  ? i === series.length - 1
                    ? [3, 3, 0, 0]
                    : [0, 0, 0, 0]
                  : [3, 3, 0, 0]
              }
              maxBarSize={stacked ? 40 : 26}
              isAnimationActive={false}
              onClick={(d: unknown) => {
                const row = d as { label?: string }
                if (row?.label) onSelect?.(row.label)
              }}
              className={onSelect ? 'cursor-pointer' : undefined}
              fillOpacity={activeLabel ? 1 : 1}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ------------------------------------------------------------------ *
 * Histogram — delay distribution.
 * ------------------------------------------------------------------ */

export function Histogram({
  data,
  height = 220,
  color = SEMANTIC.brand,
  highlightFrom,
}: {
  data: readonly { label: string; value: number; sublabel?: string }[]
  height?: number
  color?: string
  highlightFrom?: number
}) {
  return (
    <ChartFrame height={height} empty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data as { label: string; value: number }[]}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid {...gridLine} />
          <XAxis dataKey="label" tick={axisTick} axisLine={axisLine} tickLine={false} dy={4} interval={0} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => formatNumber(v, 0)} />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-hover)' }}
            wrapperStyle={{ outline: 'none' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const row = payload[0]?.payload as { value: number; sublabel?: string }
              return (
                <ChartTooltipShell>
                  <TooltipTitle>{String(label)}</TooltipTitle>
                  <TooltipRow
                    label="Orders"
                    value={formatNumber(row.value, 0)}
                    color={color}
                    strong
                  />
                  {row.sublabel ? (
                    <p className="mt-1.5 border-t border-line-soft pt-1.5 text-2xs text-fg-subtle">{row.sublabel}</p>
                  ) : null}
                </ChartTooltipShell>
              )
            }}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={44} isAnimationActive={false}>
            {data.map((row, i) => (
              <Cell
                key={row.label}
                fill={color}
                fillOpacity={highlightFrom !== undefined && i >= highlightFrom ? 1 : 0.45}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ------------------------------------------------------------------ *
 * StackedRatioBar — a 100% stacked horizontal bar, used for
 * on-time vs delayed composition in narrow lanes.
 * ------------------------------------------------------------------ */

export function StackedRatioBar({
  segments,
  height = 10,
  className,
  showLabels = true,
}: {
  segments: { label: string; value: number; color: string }[]
  height?: number
  className?: string
  showLabels?: boolean
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1

  return (
    <div className={className}>
      <div
        className="flex w-full overflow-hidden rounded-[3px] bg-surface-sunken"
        style={{ height }}
        role="img"
        aria-label={segments.map((s) => `${s.label} ${formatPercent((s.value / total) * 100, 1)}`).join(', ')}
      >
        {segments.map((s) => (
          <span
            key={s.label}
            title={`${s.label} · ${formatPercent((s.value / total) * 100, 1)}`}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            className="transition-[width] duration-500 first:rounded-l-[3px] last:rounded-r-[3px]"
          />
        ))}
      </div>
      {showLabels ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {segments.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-2xs text-fg-muted">
              <span aria-hidden className="size-1.5 rounded-[2px]" style={{ background: s.color }} />
              {s.label}
              <span className="tnum font-medium text-fg-secondary">
                {formatPercent((s.value / total) * 100, 1)}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
