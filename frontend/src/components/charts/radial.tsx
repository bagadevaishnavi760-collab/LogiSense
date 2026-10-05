import {
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { ReactNode } from 'react'
import { ChartFrame, SwatchLegend } from './primitives'
import { ChartTooltipShell, TooltipRow, TooltipTitle } from './tooltip'
import { SEMANTIC } from './theme'
import { formatNumber, formatPercent } from '../../lib/format'

export interface DonutSlice {
  name: string
  value: number
  count: number
  color: string
}

/* ------------------------------------------------------------------ *
 * DonutChart
 *
 * Centre metric + legend beside the ring. Hover dims the other slices,
 * which is what makes a donut readable at a glance.
 * ------------------------------------------------------------------ */

export function DonutChart({
  data,
  height = 210,
  centerLabel,
  centerValue,
  centerSub,
  thickness = 22,
  format = 'percent',
  showLegend = true,
  legendClassName,
  emptyLabel,
}: {
  data: readonly DonutSlice[]
  height?: number
  centerLabel?: string
  centerValue?: ReactNode
  centerSub?: ReactNode
  thickness?: number
  format?: 'percent' | 'number'
  showLegend?: boolean
  legendClassName?: string
  emptyLabel?: string
}) {
  const total = data.reduce((a, s) => a + s.value, 0)
  const outer = 84
  const inner = outer - thickness

  if (!data.length || total === 0) {
    return <ChartFrame height={height} empty emptyLabel={emptyLabel} />
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={data as DonutSlice[]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={inner}
              outerRadius={outer}
              paddingAngle={1.4}
              stroke="none"
              isAnimationActive={false}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              wrapperStyle={{ outline: 'none' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const s = payload[0]?.payload as DonutSlice
                return (
                  <ChartTooltipShell>
                    <TooltipTitle>{s.name}</TooltipTitle>
                    <TooltipRow
                      label="Share"
                      value={
                        format === 'percent'
                          ? formatPercent((s.value / total) * 100, 1)
                          : formatNumber(s.value, 0)
                      }
                      color={s.color}
                      strong
                    />
                    <TooltipRow label="Orders" value={formatNumber(s.count, 0)} />
                  </ChartTooltipShell>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[104px] truncate text-2xs font-medium uppercase tracking-[0.08em] text-fg-subtle">
            {centerLabel}
          </span>
          <span className="tnum mt-0.5 text-[22px] font-semibold leading-7 tracking-tight text-fg">
            {centerValue}
          </span>
          {centerSub ? <span className="mt-0.5 text-2xs text-fg-muted">{centerSub}</span> : null}
        </div>
      </div>

      {showLegend ? (
        <SwatchLegend
          className={legendClassName ?? 'min-w-0 flex-1'}
          items={data.map((s) => ({
            label: s.name,
            color: s.color,
            value: formatPercent((s.value / total) * 100, 1),
            sub: formatNumber(s.count, 0),
          }))}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RadialGauge — single-value gauge for model scores and quality scores.
 * ------------------------------------------------------------------ */

export function RadialGauge({
  value,
  max = 100,
  label,
  caption,
  height = 148,
  tone = 'brand',
}: {
  value: number
  max?: number
  label: string
  caption?: ReactNode
  height?: number
  tone?: keyof typeof SEMANTIC
}) {
  const pct = Math.max(0, Math.min(1, value / max))
  const data = [{ name: 'value', value: pct * 100 }]

  return (
    <div className="relative flex items-center justify-center" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          innerRadius="72%"
          outerRadius="100%"
          startAngle={220}
          endAngle={-40}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <PolarRadiusAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar
            dataKey="value"
            background={{ fill: 'var(--color-surface-sunken)' }}
            cornerRadius={999}
            fill={SEMANTIC[tone]}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4 text-center">
        <span className="tnum text-[26px] font-semibold leading-8 tracking-tight text-fg">
          {value.toFixed(value < 10 ? 2 : 0)}
        </span>
        <span className="mt-0.5 text-2xs uppercase tracking-[0.08em] text-fg-subtle">{label}</span>
        {caption ? <span className="mt-1 text-2xs text-fg-muted">{caption}</span> : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SplitRing — thin composition strip with a highlighted segment.
 * ------------------------------------------------------------------ */

export function SplitRing({
  data,
  height = 12,
}: {
  data: { name: string; value: number; color: string }[]
  height?: number
}) {
  const total = data.reduce((a, s) => a + s.value, 0) || 1
  return (
    <div
      className="flex w-full gap-px overflow-hidden rounded-full bg-surface-sunken"
      style={{ height }}
      role="img"
      aria-label={data.map((d) => `${d.name} ${formatPercent((d.value / total) * 100, 1)}`).join(', ')}
    >
      {data.map((d) => (
        <span
          key={d.name}
          title={`${d.name} · ${formatPercent((d.value / total) * 100, 1)}`}
          style={{ width: `${(d.value / total) * 100}%`, background: d.color }}
          className="h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full"
        />
      ))}
    </div>
  )
}
