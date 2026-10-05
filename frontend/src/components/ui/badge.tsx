import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

const badge = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded border font-medium transition-colors [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        neutral: 'bg-neutral-soft text-fg-secondary border-line',
        outline: 'bg-transparent text-fg-muted border-line-strong',
        brand: 'bg-brand-soft text-brand-soft-fg border-brand-line',
        success: 'bg-success-soft text-success-fg border-success/25',
        warning: 'bg-warning-soft text-warning-fg border-warning/25',
        danger: 'bg-danger-soft text-danger-fg border-danger/25',
        info: 'bg-info-soft text-info-fg border-info/25',
        violet: 'bg-violet-soft text-violet-fg border-violet/25',
        teal: 'bg-teal-soft text-teal-fg border-teal/25',
        inverse: 'bg-surface-inverse text-fg-inverse border-transparent',
      },
      size: {
        sm: 'h-5 px-1.5 text-2xs gap-1 [&_svg]:size-3',
        md: 'h-[22px] px-2 text-xs gap-1 [&_svg]:size-3.5',
        lg: 'h-6 px-2.5 text-[13px] gap-1.5 [&_svg]:size-4',
      },
      mono: {
        true: 'font-mono tracking-tight',
        false: '',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'md', mono: false },
  },
)

export interface BadgeProps
  extends ComponentPropsWithoutRef<'span'>,
    VariantProps<typeof badge> {}

export function Badge({ className, variant, size, mono, ...props }: BadgeProps) {
  return <span className={cn(badge({ variant, size, mono }), className)} {...props} />
}

/** Small filled dot used to convey state without a full badge. */
export function Dot({
  tone = 'neutral',
  pulse = false,
  className,
}: {
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'teal'
  pulse?: boolean
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-fg-subtle',
    brand: 'bg-brand',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    violet: 'bg-violet',
    teal: 'bg-teal',
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-1.5 shrink-0 rounded-full',
        tones[tone],
        pulse && 'animate-pulse-ring',
        className,
      )}
    />
  )
}

export { badge as badgeVariants }
