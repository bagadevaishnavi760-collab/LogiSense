import type { ReactNode } from 'react'
import { Lightbulb } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Sparkline } from '../charts/trend'
import { SEMANTIC } from '../charts/theme'
import { Hint } from '../ui/tooltip'
import { Delta } from './badges'
import type { Insight, Kpi, Tone } from '../../types'
import { formatCompactCurrency, formatNumber, formatPercent } from '../../lib/format'

/* ------------------------------------------------------------------ *
 * KpiCard — the metric tile.
 *
 * Hierarchy: label → large value → trend · comparison → sparkline.
 * ------------------------------------------------------------------ */

export function KpiCard({
  kpi,
  icon: Icon,
  index = 0,
}: {
  kpi: Kpi
  icon?: LucideIcon
  index?: number
}) {
  const sparkColor =
    kpi.higherIsBetter === (kpi.delta >= 0) ? SEMANTIC.success : SEMANTIC.danger

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-soft"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate text-xs font-medium text-fg-muted">{kpi.label}</h3>
          <Hint label={kpi.hint}>
            <span
              aria-label="Metric definition"
              className="flex size-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-line text-[9px] font-semibold text-fg-subtle transition-colors group-hover:border-line-strong"
            >
              ?
            </span>
          </Hint>
        </div>
        {Icon ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-sunken text-fg-muted transition-colors group-hover:text-fg-secondary">
            <Icon className="size-3.5" />
          </span>
        ) : null}
      </div>

      <p className="tnum mt-2.5 text-[27px] font-semibold leading-8 tracking-[-0.025em] text-fg">
        {formatKpi(kpi.value, kpi.format)}
      </p>

      <div className="mt-1 flex items-center gap-1.5 text-xs">
        <Delta value={kpi.delta} higherIsBetter={kpi.higherIsBetter} />
        <span className="truncate text-fg-subtle">{kpi.deltaLabel}</span>
      </div>

      <div className="-mx-1 mt-auto pt-3">
        <Sparkline data={kpi.spark} color={sparkColor} height={38} />
      </div>
    </article>
  )
}

export function KpiGrid({ kpis, icons }: { kpis: Kpi[]; icons?: LucideIcon[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi, i) => (
        <KpiCard key={kpi.key} kpi={kpi} index={i} icon={icons?.[i]} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Compact stat — inline metric for panel headers and drawers.
 * ------------------------------------------------------------------ */

const TONE_TEXT: Partial<Record<Tone, string>> = {
  success: 'text-success-fg',
  warning: 'text-warning-fg',
  danger: 'text-danger-fg',
  info: 'text-info-fg',
  violet: 'text-violet-fg',
  teal: 'text-teal-fg',
  brand: 'text-brand',
}

export function InlineStat({
  label,
  value,
  hint,
  tone,
  className,
  align = 'left',
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: Tone
  className?: string
  align?: 'left' | 'right'
}) {
  return (
    <div className={cn('min-w-0', align === 'right' && 'text-right', className)}>
      <p className="truncate text-2xs font-semibold uppercase tracking-[0.08em] text-fg-subtle">{label}</p>
      <p
        className={cn(
          'tnum mt-0.5 truncate text-lg font-semibold leading-6 tracking-tight text-fg',
          tone && TONE_TEXT[tone],
        )}
      >
        {value}
      </p>
      {hint ? <p className="truncate text-2xs text-fg-muted">{hint}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Metric — label/value/sub triplet used inside panels and drawers.
 * ------------------------------------------------------------------ */

export function Metric({
  label,
  value,
  sub,
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-fg-subtle">{label}</span>
      <span className="tnum text-[15px] font-semibold leading-6 tracking-tight text-fg">{value}</span>
      {sub ? <span className="text-2xs text-fg-muted">{sub}</span> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Insight card — narrative findings from the analytics engine.
 * ------------------------------------------------------------------ */

const TONE_STYLES: Record<Tone, { fg: string; bg: string; border: string; bar: string }> = {
  brand: { fg: 'text-brand', bg: 'bg-brand-soft', border: 'border-brand-line', bar: 'bg-brand' },
  success: { fg: 'text-success-fg', bg: 'bg-success-soft', border: 'border-success/25', bar: 'bg-success' },
  warning: { fg: 'text-warning-fg', bg: 'bg-warning-soft', border: 'border-warning/25', bar: 'bg-warning' },
  danger: { fg: 'text-danger-fg', bg: 'bg-danger-soft', border: 'border-danger/25', bar: 'bg-danger' },
  info: { fg: 'text-info-fg', bg: 'bg-info-soft', border: 'border-info/25', bar: 'bg-info' },
  violet: { fg: 'text-violet-fg', bg: 'bg-violet-soft', border: 'border-violet/25', bar: 'bg-violet' },
  teal: { fg: 'text-teal-fg', bg: 'bg-teal-soft', border: 'border-teal/25', bar: 'bg-teal' },
}

export function InsightCard({ insight, index = 0 }: { insight: Insight; index?: number }) {
  const style = TONE_STYLES[insight.tone]

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-soft"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[2px]', style.bar)} />

      <div className="flex items-start gap-2.5 pl-1">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md border',
            style.bg,
            style.border,
            style.fg,
          )}
        >
          <Lightbulb className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('text-2xs font-semibold uppercase tracking-[0.09em]', style.fg)}>
            {insight.eyebrow}
          </p>
          <h4 className="mt-1 text-[13.5px] font-semibold leading-5 text-fg text-pretty">{insight.title}</h4>
        </div>
      </div>

      <p className="mt-2.5 text-xs leading-[1.6] text-fg-muted text-pretty">{insight.body}</p>

      <div className="mt-3 flex items-baseline gap-2 border-t border-line-soft pt-3">
        <span className="tnum text-base font-semibold leading-5 tracking-tight text-fg">{insight.metric}</span>
        <span className="truncate text-2xs text-fg-subtle">{insight.metricLabel}</span>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ *
 * Shared value formatter
 * ------------------------------------------------------------------ */

export function formatKpi(value: number, format: Kpi['format']): string {
  switch (format) {
    case 'percent':
      return formatPercent(value, 1)
    case 'currency':
      return `$${formatNumber(value, 2)}`
    case 'compactCurrency':
      return formatCompactCurrency(value)
    case 'days':
      return `${value.toFixed(2)} d`
    case 'km':
      return `${formatNumber(value, 0)} km`
    case 'rating':
      return value.toFixed(2)
    case 'compact':
      return formatNumber(value, 0)
    case 'score':
      return value.toFixed(3)
    default:
      return formatNumber(value, 0)
  }
}
