import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from './button'

/* ------------------------------------------------------------------ *
 * Empty state
 * ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-6 py-10' : 'gap-3 px-6 py-16',
        className,
      )}
    >
      <span className="relative flex size-11 items-center justify-center rounded-lg border border-line bg-surface-sunken">
        <Icon className="size-5 text-fg-subtle" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-[13.5px] font-semibold text-fg">{title}</p>
        {description ? (
          <p className="text-xs leading-[1.55] text-fg-muted text-pretty">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Error state
 * ------------------------------------------------------------------ */

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      <span className="flex size-11 items-center justify-center rounded-lg border border-danger/25 bg-danger-soft">
        <AlertTriangle className="size-5 text-danger" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-[13.5px] font-semibold text-fg">{title}</p>
        {description ? <p className="text-xs leading-[1.55] text-fg-muted">{description}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Inline banner
 * ------------------------------------------------------------------ */

export function Banner({
  tone = 'info',
  title,
  children,
  icon,
  action,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success'
  title?: ReactNode
  children?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const tones = {
    info: 'border-info/25 bg-info-soft text-info-fg',
    warning: 'border-warning/25 bg-warning-soft text-warning-fg',
    danger: 'border-danger/25 bg-danger-soft text-danger-fg',
    success: 'border-success/25 bg-success-soft text-success-fg',
  }
  return (
    <div className={cn('flex items-start gap-2.5 rounded-md border px-3 py-2.5', tones[tone], className)}>
      {icon ? <span className="mt-px shrink-0 [&_svg]:size-4">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="text-[13px] font-semibold leading-5">{title}</p> : null}
        {children ? (
          <div className={cn('text-xs leading-[1.55] opacity-90 text-pretty', title && 'mt-0.5')}>{children}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Definition list — key/value pairs in a drawer or panel
 * ------------------------------------------------------------------ */

export function KeyValue({
  items,
  columns = 2,
  className,
}: {
  items: { label: string; value: ReactNode; mono?: boolean }[]
  columns?: 1 | 2 | 3
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-3.5',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 min-w-0">
          <dt className="text-2xs font-semibold uppercase tracking-[0.08em] text-fg-subtle">{item.label}</dt>
          <dd
            className={cn(
              'truncate text-[13px] font-medium text-fg',
              item.mono && 'font-mono text-xs',
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
