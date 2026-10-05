import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, RefreshCw, SearchX } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from './button'

export function EmptyState({
  title,
  description,
  icon,
  action,
  compact,
  className,
}: {
  title: string
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-xl border border-line bg-surface-sunken text-fg-subtle">
        {icon ?? <Inbox size={18} />}
      </span>
      <div className="max-w-sm space-y-1">
        <h3 className="text-[13.5px] font-semibold text-fg">{title}</h3>
        {description ? (
          <p className="text-[12px] leading-relaxed text-fg-muted text-pretty">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

export function NoResults({
  query,
  onClear,
  className,
}: {
  query?: string
  onClear?: () => void
  className?: string
}) {
  return (
    <EmptyState
      compact
      className={className}
      icon={<SearchX size={16} />}
      title="No matches"
      description={
        query ? (
          <>
            Nothing matches <span className="font-medium text-fg-secondary">“{query}”</span>. Try a
            shorter term or clear the search.
          </>
        ) : (
          'Adjust your filters to widen the result set.'
        )
      }
      action={
        onClear ? (
          <Button size="sm" variant="secondary" onClick={onClear}>
            Clear search
          </Button>
        ) : null
      }
    />
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  className,
}: {
  title?: string
  description?: ReactNode
  onRetry?: () => void
  className?: string
}) {
  return (
    <EmptyState
      className={className}
      icon={<AlertTriangle size={18} className="text-danger" />}
      title={title}
      description={description ?? 'The workspace could not be loaded. Retry, or check the data service.'}
      action={
        onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCw size={13} />
            Retry
          </Button>
        ) : null
      }
    />
  )
}