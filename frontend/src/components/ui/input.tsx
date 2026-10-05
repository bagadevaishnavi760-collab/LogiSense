import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Input({
  className,
  prefix,
  suffix,
  invalid,
  ...props
}: ComponentPropsWithoutRef<'input'> & {
  prefix?: ReactNode
  suffix?: ReactNode
  invalid?: boolean
}) {
  const field = (
    <input
      className={cn(
        'h-9 w-full rounded-md border bg-surface px-3 text-[13px] text-fg shadow-hair',
        'placeholder:text-fg-subtle',
        'transition-[border-color,box-shadow] duration-150',
        'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/18',
        'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-subtle',
        invalid ? 'border-danger/60 focus:border-danger focus:ring-danger/18' : 'border-line',
        prefix && 'pl-8',
        suffix && 'pr-16',
        className,
      )}
      {...props}
    />
  )

  if (!prefix && !suffix) return field

  return (
    <div className="relative w-full">
      {prefix ? (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle [&_svg]:size-4">
          {prefix}
        </span>
      ) : null}
      {field}
      {suffix ? <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{suffix}</span> : null}
    </div>
  )
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<'textarea'>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-fg shadow-hair',
        'placeholder:text-fg-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/18',
        className,
      )}
      {...props}
    />
  )
}

/** Label + control + optional hint, used across every form surface. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
  action,
}: {
  label: ReactNode
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-muted"
        >
          {label}
        </label>
        {action}
      </div>
      {children}
      {hint ? <p className="text-2xs leading-4 text-fg-subtle">{hint}</p> : null}
    </div>
  )
}

export function Label({ className, ...props }: ComponentPropsWithoutRef<'label'>) {
  return (
    <label
      className={cn(
        'text-2xs font-semibold uppercase tracking-[0.09em] text-fg-muted peer-disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}
