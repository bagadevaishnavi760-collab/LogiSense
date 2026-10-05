import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SegmentItem<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  hint?: string
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  items,
  size = 'md',
  className,
  full,
}: {
  value: T
  onChange: (next: T) => void
  items: readonly SegmentItem<T>[]
  size?: 'sm' | 'md'
  className?: string
  full?: boolean
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-sunken p-0.5',
        full && 'w-full',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            title={item.hint}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-[6px] font-medium whitespace-nowrap transition-all duration-150',
              size === 'sm' ? 'h-6.5 px-2 text-[11.5px]' : 'h-7.5 px-2.5 text-[12px]',
              full && 'flex-1',
              active
                ? 'bg-surface text-fg shadow-hair'
                : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function PillGroup<T extends string>({
  value,
  onChange,
  options,
  size = 'sm',
  className,
}: {
  value: T
  onChange: (next: T) => void
  options: readonly (T | { value: T; label: string })[]
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {options.map((opt) => {
        const v = (typeof opt === 'string' ? opt : opt.value) as T
        const label = typeof opt === 'string' ? opt : opt.label
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'rounded-full border font-medium transition-colors',
              size === 'xs' ? 'h-6 px-2 text-[11px]' : size === 'sm' ? 'h-7 px-2.5 text-[11.5px]' : 'h-8 px-3 text-[12.5px]',
              active
                ? 'border-brand/30 bg-brand-soft text-brand-soft-fg'
                : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg-secondary',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export interface TabItem {
  value: string
  label: string
  badge?: ReactNode
  icon?: ReactNode
}

export function Tabs({
  value,
  onChange,
  items,
  className,
}: {
  value: string
  onChange: (next: string) => void
  items: readonly TabItem[]
  className?: string
}) {
  return (
    <div className={cn('scrollbar-none flex gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1.5 px-3 pb-2 text-[12.5px] font-medium transition-colors',
              'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
              active
                ? 'text-fg after:bg-brand'
                : 'text-fg-muted after:bg-transparent hover:text-fg-secondary',
            )}
          >
            {item.icon}
            {item.label}
            {item.badge}
          </button>
        )
      })}
    </div>
  )
}

export function Collapsible({
  title,
  children,
  defaultOpen = true,
  className,
  count,
}: {
  title: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
  count?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className={cn('rounded-lg border border-line bg-surface', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-semibold text-fg">
          <ChevronDown
            size={13}
            className={cn('shrink-0 text-fg-subtle transition-transform', open && 'rotate-180')}
          />
          <span className="truncate">{title}</span>
        </span>
        {count}
      </button>
      {open ? (
        <div id={id} className="border-t border-line px-3.5 py-3">
          {children}
        </div>
      ) : null}
    </div>
  )
}