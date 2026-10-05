import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/* ------------------------------------------------------------------ *
 * Table primitives — dense, hairline-ruled, enterprise styling.
 * ------------------------------------------------------------------ */

export function TableWrap({
  className,
  children,
  maxHeight,
}: {
  className?: string
  children: ReactNode
  maxHeight?: number | string
}) {
  return (
    <div
      className={cn('scrollbar-thin w-full overflow-auto', className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-left text-[13px]">{children}</table>
    </div>
  )
}

export function THead({ className, children }: { className?: string; children: ReactNode }) {
  return <thead className={cn('sticky top-0 z-10', className)}>{children}</thead>
}

export function TBody({ className, children }: { className?: string; children: ReactNode }) {
  return <tbody className={className}>{children}</tbody>
}

export function TR({
  className,
  children,
  onClick,
  ...props
}: {
  className?: string
  children: ReactNode
  onClick?: () => void
} & Omit<React.ComponentPropsWithoutRef<'tr'>, 'onClick' | 'className' | 'children'>) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'row-hover border-b border-line-soft last:border-b-0',
        onClick && 'cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  )
}

export function TH({
  className,
  children,
  align = 'left',
  sortable = false,
  sorted,
  onSort,
  width,
  ...props
}: {
  className?: string
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  sorted?: 'asc' | 'desc' | null
  onSort?: () => void
  width?: number | string
} & Omit<React.ComponentPropsWithoutRef<'th'>, 'className' | 'children'>) {
  return (
    <th
      scope="col"
      style={width ? { width } : undefined}
      onClick={onSort}
      className={cn(
        'border-b border-line bg-surface-sunken px-3 py-2 text-2xs font-semibold uppercase tracking-[0.075em] text-fg-muted',
        'whitespace-nowrap select-none first:pl-4 last:pr-4',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        sortable && 'cursor-pointer transition-colors hover:text-fg',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {children}
        {sortable ? (
          <span
            aria-hidden
            className={cn(
              'text-[9px] leading-none transition-colors',
              sorted ? 'text-brand' : 'text-fg-subtle/60',
            )}
          >
            {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}
          </span>
        ) : null}
      </span>
    </th>
  )
}

export function TD({
  className,
  children,
  align = 'left',
  ...props
}: {
  className?: string
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
} & Omit<React.ComponentPropsWithoutRef<'td'>, 'className' | 'children'>) {
  return (
    <td
      className={cn(
        'px-3 py-2 text-fg-secondary first:pl-4 last:pr-4',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}

/** Two-line cell: primary value + muted secondary context. */
export function CellStack({
  primary,
  secondary,
  mono = false,
  className,
}: {
  primary: ReactNode
  secondary?: ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <span className={cn('truncate font-medium text-fg', mono && 'font-mono text-xs')}>{primary}</span>
      {secondary ? <span className="truncate text-xs text-fg-muted">{secondary}</span> : null}
    </div>
  )
}
