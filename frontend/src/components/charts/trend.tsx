import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SEMANTIC } from './theme'
import {
  AreaGradient,
  ChartFrame,
  axisLine,
  axisTick,
  cursorLine,
  gridLine,
  useGradientId,
} from './primitives'
import { DefaultTooltip, TooltipRow } from './tooltip'
import { formatNumber, formatPercent } from '../../lib/format'
/* ------------------------------------------------------------------ *
 * Sparkline — used inside KPI tiles. Purely decorative + accessible
 * summary via aria-label, no axes, no tooltip.
 * ------------------------------------------------------------------ */

export function Sparkline({
  data,
  color = SEMANTIC.brand,
  height = 40,
  type = 'area',
  strokeWidth = 1.5,
}: {
  data: number[]
  color?: string
  height?: number
  type?: 'area' | 'line'
  strokeWidth?: number
}) {
  const id = useGradientId('spark')
  if (!data.length) return <div style={{ height }} />

  const points = data.map((v, i) => ({ i, v }))
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pad = (max - min) * 0.18 || Math.abs(max) * 0.1 || 1
  const domain: [number, number] = [min - pad, max + pad]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <AreaGradient id={id} color={color} opacity={0.2} />
        </defs>
        <YAxis hide domain={domain} />
        <XAxis hide dataKey="i" />
        {type === 'area' ? (
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={strokeWidth}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
          />
        ) : (
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            isAnimationActive={false}
            dot={false}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ *
 * TrendChart — the workhorse time-series chart.
 *
 * Supports a left axis in days, a right axis in percent, an optional
 * comparison series and an optional highlight band (e.g. forecast window).
 * ------------------------------------------------------------------ */

export interface TrendSeries {
  key: string
  label: string
  color?: string
  axis?: 'left' | 'right'
  dashed?: boolean
  format?: 'days' | 'percent' | 'number' | 'currency' | 'compactCurrency'
}

export function TrendChart({
  data,
  series,
  height = 300,
  leftFormat = 'days',
  rightFormat = 'percent',
  leftDomain,
  leftTicks,
  rightDomain,
  reference,
  band,
  onPointClick,
  activeKey,
}: {
  data: readonly Record<string, unknown>[]
  series: TrendSeries[]
  height?: number
  leftFormat?: 'days' | 'number' | 'percent' | 'currency' | 'compactCurrency'
  rightFormat?: 'days' | 'percent' | 'number' | 'currency' | 'compactCurrency'
  leftDomain?: [number, number]
  leftTicks?: number
  rightDomain?: [number, number]
  reference?: { value: number; label: string; axis?: 'left' | 'right' }
  band?: { from: number | string; to: number | string; label: string }
  onPointClick?: (row: Record<string, unknown>) => void
  activeKey?: string | null
}) {
  const visible = activeKey ? series.filter((s) => s.key === activeKey) : series
  const usesRight = visible.some((s) => s.axis === 'right')

  const fmt = (v: number, f: TrendSeries['format']) => {
    switch (f) {
      case 'days':
        return `${v.toFixed(2)} d`
      case 'percent':
        return formatPercent(v, 1)
      case 'currency':
        return `$${formatNumber(v, 0)}`
      case 'compactCurrency':
        return `$${(v / 1_000_000).toFixed(2)}M`
      default:
        return formatNumber(v, 0)
    }
  }

  return (
    <ChartFrame height={height} empty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data as Record<string, unknown>[]}
          margin={{ top: 8, right: usesRight ? 4 : 12, bottom: 0, left: 0 }}
          onClick={(state) => {
            if (!onPointClick || !state || typeof state === 'string') return
            const row = (state as { activePayload?: { payload?: Record<string, unknown> }[] }).activePayload?.[0]
              ?.payload
            if (row) onPointClick(row)
          }}
        >
          <CartesianGrid {...gridLine} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            axisLine={axisLine}
            tickLine={false}
            minTickGap={18}
            dy={4}
          />
          <YAxis
            yAxisId="left"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={44}
            domain={leftDomain ?? ['auto', 'auto']}
            tickCount={leftTicks}
            tickFormatter={(v: number) => fmt(v, leftFormat)}
          />
          {usesRight ? (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={rightDomain ?? ['auto', 'auto']}
              tickFormatter={(v: number) => fmt(v, rightFormat)}
            />
          ) : null}
          <Tooltip
            cursor={cursorLine}
            wrapperStyle={{ outline: 'none' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const row = payload[0]?.payload as Record<string, unknown> | undefined
              return (
                <div className="min-w-[200px] rounded-lg border border-line bg-surface-raised px-3 py-2.5 shadow-pop">
                  <p className="mb-2 border-b border-line-soft pb-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-fg-muted">
                    {(row?.fullLabel as string) ?? String(label)}
                  </p>
                  {visible.map((s) => (
                    <TooltipRow
                      key={s.key}
                      label={s.label}
                      value={fmt(Number(row?.[s.key] ?? 0), s.format)}
                      color={s.color ?? SEMANTIC.brand}
                    />
                  ))}
                  {row && 'orders' in row ? (
                    <p className="mt-2 border-t border-line-soft pt-1.5 text-2xs text-fg-subtle">
                      {formatNumber(Number(row.orders))} orders in period
                    </p>
                  ) : null}
                </div>
              )
            }}
          />
          {band ? (
            <ReferenceArea
              yAxisId="left"
              x1={band.from}
              x2={band.to}
              fill="var(--color-brand)"
              fillOpacity={0.05}
              label={{ value: band.label, position: 'insideTopRight', fill: 'var(--color-fg-subtle)', fontSize: 10 }}
            />
          ) : null}
          {reference ? (
            <ReferenceLine
              yAxisId={reference.axis ?? 'left'}
              y={reference.value}
              stroke="var(--color-fg-subtle)"
              strokeDasharray="4 4"
              label={{
                value: reference.label,
                position: 'insideTopLeft',
                fill: 'var(--color-fg-subtle)',
                fontSize: 10,
              }}
            />
          ) : null}
          {visible.map((s, i) => (
            <Line
              key={s.key}
              yAxisId={s.axis ?? 'left'}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? SEMANTIC.brand}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: 'var(--color-surface)' }}
              isAnimationActive={false}
              connectNulls
              hide={activeKey ? activeKey !== s.key : false}
              legendType={i === 0 ? 'line' : 'none'}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ------------------------------------------------------------------ *
 * AreaTrend — single metric with a filled area. Used for spend,
 * order volume and cost-per-order trends.
 * ------------------------------------------------------------------ */

export function AreaTrend({
  data,
  dataKey,
  color = SEMANTIC.brand,
  height = 220,
  format = 'number',
  label = 'Value',
  yDomain,
}: {
  data: readonly Record<string, unknown>[]
  dataKey: string
  color?: string
  height?: number
  format?: 'days' | 'percent' | 'number' | 'currency' | 'compactCurrency'
  label?: string
  yDomain?: [number, number]
}) {
  const id = useGradientId('area')

  const fmt = (v: number) => {
    switch (format) {
      case 'days':
        return `${v.toFixed(2)} d`
      case 'percent':
        return formatPercent(v, 1)
      case 'currency':
        return `$${formatNumber(v, 0)}`
      case 'compactCurrency':
        return `$${(v / 1_000_000).toFixed(2)}M`
      default:
        return formatNumber(v, 0)
    }
  }

  return (
    <ChartFrame height={height} empty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data as Record<string, unknown>[]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <AreaGradient id={id} color={color} opacity={0.18} />
          </defs>
          <CartesianGrid {...gridLine} />
          <XAxis dataKey="label" tick={axisTick} axisLine={axisLine} tickLine={false} minTickGap={16} dy={4} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={yDomain ?? ['auto', 'auto']}
            tickFormatter={(v: number) => fmt(v)}
          />
          <Tooltip
            cursor={cursorLine}
            wrapperStyle={{ outline: 'none' }}
            content={<DefaultTooltip format={(v) => fmt(v)} titleFormatter={(l) => String(l)} />}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: 'var(--color-surface)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
