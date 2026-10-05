import { Badge, Dot } from '../ui/badge'
import { cn } from '../../lib/cn'
import { riskColor, statusColor } from '../charts/theme'
import type { BadgeProps } from '../ui/badge'
import type { OrderStatus, RiskLevel, Tone } from '../../types'
import { AlertOctagon, ArrowDownRight, ArrowUpRight, CircleCheck, Clock, PackageX, Truck } from 'lucide-react'

/* ------------------------------------------------------------------ *
 * Status badges — one mapping, used everywhere so the product never
 * shows two colours for the same state.
 * ------------------------------------------------------------------ */

const STATUS_MAP: Record<OrderStatus, { variant: BadgeProps['variant']; icon: typeof Clock; label: string }> = {
  Delivered: { variant: 'success', icon: CircleCheck, label: 'Delivered' },
  'In Transit': { variant: 'info', icon: Truck, label: 'In transit' },
  Delayed: { variant: 'warning', icon: Clock, label: 'Delayed' },
  Returned: { variant: 'violet', icon: PackageX, label: 'Returned' },
  Exception: { variant: 'danger', icon: AlertOctagon, label: 'Exception' },
}

export function StatusBadge({ status, size = 'md', className }: { status: OrderStatus; size?: BadgeProps['size']; className?: string }) {
  const cfg = STATUS_MAP[status]
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} size={size} className={className}>
      <Icon />
      {cfg.label}
    </Badge>
  )
}

export function statusTone(status: OrderStatus): Tone {
  if (status === 'Delivered') return 'success'
  if (status === 'Delayed') return 'warning'
  if (status === 'Exception') return 'danger'
  if (status === 'Returned') return 'violet'
  return 'info'
}

/* ------------------------------------------------------------------ *
 * Risk badge + meter
 * ------------------------------------------------------------------ */

const RISK_VARIANT: Record<RiskLevel, BadgeProps['variant']> = {
  Low: 'success',
  Moderate: 'info',
  High: 'warning',
  Critical: 'danger',
}

export function RiskBadge({
  level,
  score,
  size = 'md',
  showScore = true,
  className,
}: {
  level: RiskLevel
  score?: number
  size?: BadgeProps['size']
  showScore?: boolean
  className?: string
}) {
  return (
    <Badge variant={RISK_VARIANT[level]} size={size} className={className}>
      <Dot tone={level === 'Low' ? 'success' : level === 'Moderate' ? 'info' : level === 'High' ? 'warning' : 'danger'} />
      {level}
      {showScore && score !== undefined ? <span className="tnum opacity-70">· {score}</span> : null}
    </Badge>
  )
}

export function RiskMeter({
  score,
  threshold = 35,
  className,
  showLabel = true,
}: {
  score: number
  threshold?: number
  className?: string
  showLabel?: boolean
}) {
  const pct = Math.max(0, Math.min(100, score))
  const over = score >= threshold
  const color = riskColor(
    pct >= 68 ? 'Critical' : pct >= 55 ? 'High' : pct >= 42 ? 'Moderate' : 'Low',
  )
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative h-1.5 w-full min-w-[52px] overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
        <span
          aria-hidden
          className="absolute top-0 h-full w-px bg-fg-subtle/70"
          style={{ left: `${threshold}%` }}
        />
      </div>
      {showLabel ? (
        <span className="tnum w-6 shrink-0 text-right text-2xs font-medium text-fg-secondary">{pct}</span>
      ) : null}
      {over ? <span className="sr-only">above threshold</span> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Delta — trend indicator with semantic colouring.
 * ------------------------------------------------------------------ */

export function Delta({
  value,
  higherIsBetter = true,
  suffix = '%',
  className,
  size = 'md',
  neutral = false,
}: {
  value: number
  higherIsBetter?: boolean
  suffix?: string
  className?: string
  size?: 'sm' | 'md'
  neutral?: boolean
}) {
  const flat = Math.abs(value) < 0.05
  const good = higherIsBetter ? value > 0 : value < 0
  const tone = flat || neutral ? 'text-fg-muted' : good ? 'text-success-fg' : 'text-danger-fg'
  const Icon = flat ? null : value > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-0.5 font-medium',
        size === 'sm' ? 'text-2xs' : 'text-xs',
        tone,
        className,
      )}
    >
      {Icon ? <Icon className="size-3" /> : <span className="w-3" />}
      {flat ? '0.0' : `${Math.abs(value).toFixed(1)}`}
      {suffix}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Health pill
 * ------------------------------------------------------------------ */

const HEALTH: Record<string, { label: string; variant: BadgeProps['variant']; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  operational: { label: 'Operational', variant: 'success', tone: 'success' },
  degraded: { label: 'Degraded', variant: 'warning', tone: 'warning' },
  outage: { label: 'Outage', variant: 'danger', tone: 'danger' },
  maintenance: { label: 'Maintenance', variant: 'info', tone: 'info' },
  success: { label: 'Success', variant: 'success', tone: 'success' },
  running: { label: 'Running', variant: 'info', tone: 'info' },
  warning: { label: 'Warning', variant: 'warning', tone: 'warning' },
  failure: { label: 'Failed', variant: 'danger', tone: 'danger' },
  stable: { label: 'Stable', variant: 'success', tone: 'success' },
  moderate: { label: 'Moderate drift', variant: 'warning', tone: 'warning' },
  significant: { label: 'Significant drift', variant: 'danger', tone: 'danger' },
  healthy: { label: 'Healthy', variant: 'success', tone: 'success' },
  watch: { label: 'Watch', variant: 'warning', tone: 'warning' },
  risk: { label: 'At risk', variant: 'danger', tone: 'danger' },
  pass: { label: 'Pass', variant: 'success', tone: 'success' },
  warn: { label: 'Warn', variant: 'warning', tone: 'warning' },
  fail: { label: 'Fail', variant: 'danger', tone: 'danger' },
}

export function HealthBadge({
  state,
  size = 'md',
  pulse = false,
  className,
}: {
  state: string
  size?: BadgeProps['size']
  pulse?: boolean
  className?: string
}) {
  const cfg = HEALTH[state] ?? { label: state, variant: 'neutral' as const, tone: 'info' as const }
  return (
    <Badge variant={cfg.variant} size={size} className={className}>
      <Dot tone={cfg.tone} pulse={pulse && cfg.tone === 'success'} />
      {cfg.label}
    </Badge>
  )
}

export { STATUS_MAP, statusColor }
