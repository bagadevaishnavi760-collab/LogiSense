import type { TooltipContentProps, TooltipProps } from 'recharts'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/* ------------------------------------------------------------------ *
 * Recharts tooltip shell — one visual language across every chart.
 * ------------------------------------------------------------------ */

export function ChartTooltipShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'min-w-[172px] rounded-lg border border-line bg-surface-raised px-3 py-2.5 shadow-pop',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function TooltipTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 border-b border-line-soft pb-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-fg-muted">
      {children}
    </p>
  )
}

export function TooltipRow({
  label,
  value,
  color,
  strong = false,
  suffix,
}: {
  label: string
  value: ReactNode
  color?: string
  strong?: boolean
  suffix?: string
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-[3px]">
      <span className="flex items-center gap-1.5 text-xs text-fg-muted">
        {color ? (
          <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} />
        ) : null}
        {label}
      </span>
      <span
        className={cn(
          'tnum font-medium text-fg',
          strong ? 'text-[13px]' : 'text-xs',
        )}
      >
        {value}
        {suffix ? <span className="ml-0.5 font-normal text-fg-muted">{suffix}</span> : null}
      </span>
    </div>
  )
}

export function TooltipFooter({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 border-t border-line-soft pt-1.5 text-2xs text-fg-subtle">{children}</p>
  )
}

type AnyProps = TooltipProps<number, string> & TooltipContentProps<number, string>

/**
 * Generic categorical tooltip renderer. Reads the active payload and renders
 * each series with a colour swatch. `format` controls value rendering.
 */
export function DefaultTooltip({
  active,
  payload,
  label,
  format = (v) => String(v),
  titleFormatter,
  footer,
  hideZero = false,
}: {
  active?: boolean
  payload?: AnyProps['payload']
  label?: AnyProps['label']
  format?: (value: number, name: string) => ReactNode
  titleFormatter?: (label: string | number) => ReactNode
  footer?: (label: string | number) => ReactNode
  hideZero?: boolean
}) {
  if (!active || !payload?.length) return null

  const rows = payload.filter((p) => !hideZero || (typeof p.value === 'number' && p.value !== 0))

  return (
    <ChartTooltipShell>
      <TooltipTitle>{titleFormatter ? titleFormatter(label ?? '') : label}</TooltipTitle>
      <div className="flex flex-col">
        {rows.map((p, i) => (
          <TooltipRow
            key={`${String(p.dataKey)}-${i}`}
            label={String(p.name ?? p.dataKey ?? '')}
            value={format(Number(p.value ?? 0), String(p.name ?? ''))}
            color={p.color ?? p.payload?.fill}
          />
        ))}
      </div>
      {footer ? <TooltipFooter>{footer(label ?? '')}</TooltipFooter> : null}
    </ChartTooltipShell>
  )
}
