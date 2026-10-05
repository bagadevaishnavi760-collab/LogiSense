import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export function SelectTrigger({
  className,
  children,
  size = 'md',
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'group inline-flex w-full items-center justify-between gap-2 rounded-md border border-line bg-surface',
        'text-[13px] text-fg shadow-hair transition-[border-color,box-shadow] duration-150',
        'hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/18',
        'data-[placeholder]:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-50',
        '[&>span]:line-clamp-1 [&>span]:text-left',
        size === 'sm' && 'h-8 px-2.5',
        size === 'md' && 'h-9 px-3',
        size === 'lg' && 'h-10 px-3.5 text-sm',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-3.5 shrink-0 text-fg-subtle transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={5}
        className={cn(
          'relative z-[70] max-h-[min(24rem,60vh)] min-w-[9rem] overflow-hidden',
          'rounded-lg border border-line bg-surface-raised shadow-pop',
          'data-[state=open]:animate-fade-in',
          position === 'popper' && 'w-[var(--radix-select-trigger-width)]',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-fg-subtle">
          <ChevronDown className="size-3 rotate-180" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="scrollbar-thin p-1">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-fg-subtle">
          <ChevronDown className="size-3" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-7 text-[13px]',
        'text-fg-secondary outline-none transition-colors',
        'data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg data-[state=checked]:text-fg data-[state=checked]:font-medium',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5 text-brand" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

export function SelectLabel({ className, ...props }: ComponentPropsWithoutRef<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn(
        'px-2 py-1.5 text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle',
        className,
      )}
      {...props}
    />
  )
}

export function SelectSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-line', className)} {...props} />
}

/** Compact labelled select used in filter bars and toolbars. */
export function SelectField({
  label,
  value,
  onValueChange,
  options,
  className,
  widthClass = 'w-[150px]',
  placeholder,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: readonly { value: string; label: string }[]
  className?: string
  widthClass?: string
  placeholder?: string
}) {
  return (
    <div className={cn(widthClass, className)}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger size="sm" aria-label={label}>
          <SelectValue placeholder={placeholder ?? label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function SelectOption({ value, label }: { value: string; label: ReactNode }) {
  return <SelectItem value={value}>{label}</SelectItem>
}
