import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { useState } from 'react'
import { ChartFrame, axisLine, axisTick, gridLine } from './primitives'
import { ChartTooltipShell, TooltipRow, TooltipTitle } from './tooltip'
import { SEMANTIC } from './theme'
import { formatNumber, formatPercent } from '../../lib/format'

/* ------------------------------------------------------------------ *
 * ScatterPlot — volume vs cost-per-order / distance vs delay, with an
 * optional linear trend line so a relationship is actually visible.
 * ------------------------------------------------------------------ */

export interface ScatterPoint {
  label: string
  x: number
  y: number
  z?: number
  color?: string
  meta?: string
}

function leastSquares(points: { x: number; y: number }[]) {
  const n = points.length
  if (n < 2) return null
  const mx = points.reduce((a, p) => a + p.x, 0) / n
  const my = points.reduce((a, p) => a + p.y, 0) / n
  let num = 0
  let den = 0
  for (const p of points) {
    num += (p.x - mx) * (p.y - my)
    den += (p.x - mx) ** 2
  }
  if (den === 0) return null
  const slope = num / den
  const intercept = my - slope * mx
  const r =
    (() => {
      let cov = 0
      let vx = 0
      let vy = 0
      for (const p of points) {
        cov += (p.x - mx) * (p.y - my)
        vx += (p.x - mx) ** 2
        vy += (p.y - my) ** 2
      }
      return vx && vy ? cov / Math.sqrt(vx * vy) : 0
    })()
  return { slope, intercept, r }
}

export function ScatterPlot({
  data,
  height = 280,
  xLabel,
  yLabel,
  xFormat = 'number',
  yFormat = 'number',
  trend = true,
  zMax,
  color = SEMANTIC.brand,
  onSelect,
  quadrant,
}: {
  data: readonly ScatterPoint[]
  height?: number
  xLabel: string
  yLabel: string
  xFormat?: 'number' | 'km' | 'days' | 'percent' | 'currency'
  yFormat?: 'number' | 'km' | 'days' | 'percent' | 'currency'
  trend?: boolean
  zMax?: number
  color?: string
  onSelect?: (label: string) => void
  /** Draws the median crosshair — instantly shows which points are outliers. */
  quadrant?: boolean
}) {
  const [hover, setHover] = useState<string | null>(null)

  const fmt = (v: number, f: typeof xFormat) => {
    switch (f) {
      case 'km':
        return `${formatNumber(v, 0)} km`
      case 'days':
        return `${v.toFixed(2)} d`
      case 'percent':
        return formatPercent(v, 1)
      case 'currency':
        return `$${formatNumber(v, 0)}`
      default:
        return formatNumber(v, 0)
    }
  }

  const fit = trend ? leastSquares(data as ScatterPoint[]) : null
  const xs = data.map((d) => d.x)
  const ys = data.map((d) => d.y)
  const xMin = Math.min(...xs, 0)
  const xMax = Math.max(...xs, 1)
  const yMin = Math.min(...ys, 0)
  const yMax = Math.max(...ys, 1)
  const medX = median(xs)
  const medY = median(ys)

  const trendLine = fit
    ? [
        { x: xMin, y: fit.intercept + fit.slope * xMin },
        { x: xMax, y: fit.intercept + fit.slope * xMax },
      ]
    : []

  if (!data.length) return <ChartFrame height={height} empty />

  return (
    <div className="flex flex-col gap-2">
      <ChartFrame height={height}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 14, bottom: 22, left: 4 }}>
            <CartesianGrid {...gridLine} />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              tick={axisTick}
              axisLine={axisLine}
              tickLine={false}
              tickFormatter={(v: number) => fmt(v, xFormat)}
              label={{
                value: xLabel,
                position: 'insideBottom',
                offset: -12,
                fill: 'var(--color-fg-subtle)',
                fontSize: 10,
              }}
              domain={[xMin, xMax]}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(v: number) => fmt(v, yFormat)}
              label={{
                value: yLabel,
                angle: -90,
                position: 'insideLeft',
                offset: 2,
                fill: 'var(--color-fg-subtle)',
                fontSize: 10,
              }}
              domain={[yMin, yMax]}
            />
            {zMax ? <ZAxis type="number" dataKey="z" range={[40, 400]} /> : null}
            {quadrant ? (
              <>
                <ReferenceLine x={medX} stroke="var(--color-line-strong)" strokeDasharray="3 4" />
                <ReferenceLine y={medY} stroke="var(--color-line-strong)" strokeDasharray="3 4" />
              </>
            ) : null}
            {trendLine.length ? (
              <Scatter
                data={trendLine as ScatterPoint[]}
                line={{ stroke: 'var(--color-fg-subtle)', strokeWidth: 1.5, strokeDasharray: '5 4' }}
                lineType="fitting"
                isAnimationActive={false}
                shape={() => null}
              />
            ) : null}
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: 'var(--color-line-strong)' }}
              wrapperStyle={{ outline: 'none' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0]?.payload as ScatterPoint
                return (
                  <ChartTooltipShell>
                    <TooltipTitle>{p.label}</TooltipTitle>
                    <TooltipRow label={xLabel} value={fmt(p.x, xFormat)} />
                    <TooltipRow label={yLabel} value={fmt(p.y, yFormat)} strong />
                    {p.z ? <TooltipRow label="Orders" value={formatNumber(p.z, 0)} /> : null}
                    {p.meta ? (
                      <p className="mt-1.5 border-t border-line-soft pt-1.5 text-2xs text-fg-subtle">{p.meta}</p>
                    ) : null}
                  </ChartTooltipShell>
                )
              }}
            />
            <Scatter
              data={data as ScatterPoint[]}
              isAnimationActive={false}
              onMouseEnter={(p: unknown) => setHover((p as ScatterPoint).label)}
              onMouseLeave={() => setHover(null)}
              onClick={(p: unknown) => onSelect?.((p as ScatterPoint).label)}
              shape={(props: unknown) => {
                const p = props as {
                  cx?: number
                  cy?: number
                  payload?: ScatterPoint
                }
                const cx = p.cx ?? 0
                const cy = p.cy ?? 0
                const payload = p.payload
                const size = Math.max(5, Math.min(26, Math.sqrt(payload?.z ?? 900) / 3.4))
                const active = hover === payload?.label
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={active ? size + 2 : size}
                    fill={payload?.color ?? color}
                    fillOpacity={hover && !active ? 0.35 : 0.82}
                    stroke={active ? 'var(--color-fg)' : 'none'}
                    strokeWidth={1.5}
                    className="transition-[r,fill-opacity] duration-150"
                  />
                )
              }}
            >
              {data.map((d) => (
                <Cell key={d.label} fill={d.color ?? color} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </ChartFrame>

      {fit ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-soft pt-2">
          <span className="inline-flex items-center gap-1.5 text-2xs text-fg-muted">
            <span
              aria-hidden
              className="h-0.5 w-4 rounded-full"
              style={{
                backgroundImage: 'repeating-linear-gradient(90deg, currentColor 0 4px, transparent 4px 8px)',
                color: 'var(--color-fg-subtle)',
              }}
            />
            Least-squares fit
          </span>
          <span className="tnum text-2xs text-fg-secondary">
            slope {fit.slope >= 0 ? '+' : '−'}
            {Math.abs(fit.slope).toFixed(3)} / {fmt(1, xFormat)}
          </span>
          <span className="tnum text-2xs text-fg-secondary">r = {fit.r.toFixed(3)}</span>
          <span className="text-2xs text-fg-subtle">
            {Math.abs(fit.r) > 0.7 ? 'Strong' : Math.abs(fit.r) > 0.4 ? 'Moderate' : 'Weak'} linear association
          </span>
        </div>
      ) : null}
    </div>
  )
}

function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
