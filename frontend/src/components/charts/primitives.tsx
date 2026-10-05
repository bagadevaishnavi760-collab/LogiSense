import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

/* ------------------------------------------------------------------ *
 * ChartFrame
 *
 * Every chart on the product renders inside this frame: fixed height, no
 * in-card padding (the Panel owns it), and a consistent empty/error slot.
 * ------------------------------------------------------------------ */

export function ChartFrame({
  height = 260,
  children,
  className,
  loading = false,
  empty = false,
  emptyLabel = 'No data for the current selection',
}: {
  height?: number
  children?: ReactNode
  className?: string
  loading?: boolean
  empty?: boolean
  emptyLabel?: string
}) {
  if (loading) {
    return (
      <div className={cn('flex w-full flex-col justify-end gap-2 px-1', className)} style={{ height }}>
        {[0.45, 0.72, 0.38, 0.86, 0.6].map((h, i) => (
          <span
            key={i}
            className="block w-full animate-pulse rounded-[3px] bg-surface-sunken"
            style={{ height: `${h * 100 * 0.16}%` }}
          />
        ))}
      </div>
    )
  }

  if (empty) {
    return (
      <div
        className={cn('flex flex-col items-center justify-center gap-2 text-center', className)}
        style={{ height }}
      >
        <svg viewBox="0 0 48 32" className="h-8 w-12 text-line-strong" aria-hidden>
          <rect x="1" y="1" width="46" height="30" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 22 L14 16 L21 20 L28 10 L35 14 L42 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3" />
        </svg>
        <p className="text-xs text-fg-muted">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Legend
 * ------------------------------------------------------------------ */

export interface LegendEntry {
  label: string
  color: string
  value?: ReactNode
  onClick?: () => void
  active?: boolean
  dashed?: boolean
}

export function ChartLegend({
  entries,
  className,
  onReset,
  align = 'left',
}: {
  entries: LegendEntry[]
  className?: string
  onReset?: () => void
  align?: 'left' | 'center' | 'right'
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1.5',
        align === 'center' && 'justify-center',
        align === 'right' && 'justify-end',
        className,
      )}
    >
      {entries.map((e) => {
        const Tag = e.onClick ? 'button' : 'span'
        return (
          <Tag
            key={e.label}
            type={e.onClick ? 'button' : undefined}
            onClick={e.onClick}
            className={cn(
              'group inline-flex items-center gap-1.5 text-2xs transition-opacity',
              e.onClick && 'cursor-pointer hover:opacity-80',
              e.active === false && 'opacity-40',
            )}
          >
            <span
              aria-hidden
              className={cn('h-0.5 w-3 shrink-0 rounded-full', e.dashed && 'opacity-70')}
              style={
                e.dashed
                  ? {
                      backgroundImage:
                        'repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 6px)',
                      backgroundColor: 'transparent',
                      color: e.color,
                    }
                  : { backgroundColor: e.color }
              }
            />
            <span className="text-fg-muted group-hover:text-fg-secondary">{e.label}</span>
            {e.value !== undefined ? <span className="tnum font-medium text-fg-secondary">{e.value}</span> : null}
          </Tag>
        )
      })}
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="text-2xs text-fg-subtle underline-offset-2 transition-colors hover:text-fg hover:underline"
        >
          Reset
        </button>
      ) : null}
    </div>
  )
}

/** Discrete colour swatches for pie/donut legends with values. */
export function SwatchLegend({
  items,
  className,
}: {
  items: { label: string; color: string; value: string; sub?: string }[]
  className?: string
}) {
  return (
    <div className={cn('flex flex-col divide-y divide-line-soft', className)}>
      {items.map((i) => (
        <div key={i.label} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: i.color }} />
            <span className="truncate text-[13px] text-fg-secondary">{i.label}</span>
          </span>
          <span className="flex shrink-0 items-baseline gap-2">
            {i.sub ? <span className="tnum text-2xs text-fg-subtle">{i.sub}</span> : null}
            <span className="tnum text-[13px] font-semibold text-fg">{i.value}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Gradient defs
 * ------------------------------------------------------------------ */

export function useGradientId(prefix: string): string {
  const id = useId()
  return `${prefix}${id.replace(/[^a-zA-Z0-9]/g, '')}`
}

export function AreaGradient({
  id,
  color,
  opacity = 0.16,
}: {
  id: string
  color: string
  opacity?: number
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={opacity} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  )
}

/* ------------------------------------------------------------------ *
 * Axis helpers
 * ------------------------------------------------------------------ */

export const axisTick = { fill: 'var(--color-axis)', fontSize: 11 } as const
export const axisLine = { stroke: 'var(--color-line)' } as const
export const gridLine = { stroke: 'var(--color-grid)' } as const
export const cursorLine = { stroke: 'var(--color-line-strong)', strokeWidth: 1 } as const
