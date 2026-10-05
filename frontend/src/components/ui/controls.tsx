import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '../../lib/cn'

/* -------------------------------- Switch ---------------------------- */

export function Switch({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent',
        'transition-colors duration-200 outline-none',
        'focus-visible:ring-2 focus-visible:ring-brand/25',
        'data-[state=checked]:bg-brand data-[state=unchecked]:bg-line-strong',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-3.5 rounded-full bg-white shadow-hair ring-0',
          'transition-transform duration-200',
          'data-[state=checked]:translate-x-[15px] data-[state=unchecked]:translate-x-[2px]',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  icon,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  icon?: ReactNode
}) {
  return (
    <label
      className={cn(
        'flex items-start justify-between gap-4 py-3',
        disabled ? 'opacity-60' : 'cursor-pointer',
      )}
    >
      <span className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-fg-subtle [&_svg]:size-4">{icon}</span> : null}
        <span className="min-w-0">
          <span className="block text-[13px] font-medium leading-5 text-fg">{label}</span>
          {description ? (
            <span className="mt-0.5 block text-xs leading-[1.45] text-fg-muted">{description}</span>
          ) : null}
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </label>
  )
}

/* ------------------------------ Progress ---------------------------- */

const bar = cva('relative w-full overflow-hidden rounded-full', {
  variants: {
    size: { xs: 'h-1', sm: 'h-1.5', md: 'h-2' },
  },
  defaultVariants: { size: 'sm' },
})

export function Progress({
  className,
  value = 0,
  tone = 'brand',
  size = 'sm',
  label,
}: {
  className?: string
  value: number
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'teal'
  size?: 'xs' | 'sm' | 'md'
  label?: string
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    violet: 'bg-violet',
    teal: 'bg-teal',
  }
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(bar({ size }), 'bg-surface-sunken')}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tones[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export const ProgressPrimitiveRoot = ProgressPrimitive.Root

/* ----------------------------- Separator ---------------------------- */

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative
      orientation={orientation}
      className={cn(
        'shrink-0 bg-line',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
}

/* -------------------------------- Tabs ------------------------------ */

export const Tabs = TabsPrimitive.Root

export function TabsList({
  className,
  children,
  variant = 'underline',
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: 'underline' | 'pill' }) {
  return (
    <TabsPrimitive.List
      className={cn(
        'relative flex items-center',
        variant === 'underline' &&
          'gap-1 overflow-x-auto border-b border-line [&::-webkit-scrollbar]:hidden [scrollbar-width:none]',
        variant === 'pill' && 'gap-0.5 rounded-md border border-line bg-surface-sunken p-0.5',
        className,
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  )
}

export function TabsTrigger({
  className,
  children,
  variant = 'underline',
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { variant?: 'underline' | 'pill' }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative whitespace-nowrap text-[13px] font-medium text-fg-muted outline-none transition-colors',
        'hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/25 disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:text-fg',
        variant === 'underline' &&
          'px-3 py-2 after:absolute after:inset-x-2 after:bottom-[-1px] after:h-[2px] after:rounded-full after:bg-brand after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100',
        variant === 'pill' &&
          'rounded-sm px-2.5 py-1 text-xs data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-hair',
        className,
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Trigger>
  )
}

export function TabsContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('mt-4 outline-none data-[state=active]:animate-fade-in', className)}
      {...props}
    >
      {children}
    </TabsPrimitive.Content>
  )
}

/* ---------------------------- Segmented ----------------------------- */

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

/** Sliding segmented control used for metric/granularity switches. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-line bg-surface-sunken p-0.5',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm font-medium transition-all duration-150',
              size === 'sm' ? 'h-6 px-2 text-2xs' : 'h-7 px-2.5 text-xs',
              active
                ? 'bg-surface text-fg shadow-hair'
                : 'text-fg-muted hover:text-fg-secondary',
              '[&_svg]:size-3.5',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export type { VariantProps }
