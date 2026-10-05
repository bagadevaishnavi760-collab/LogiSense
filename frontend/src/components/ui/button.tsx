import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

const button = cva(
  'relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-brand-fg shadow-hair hover:bg-brand-hover border border-brand/0',
        secondary:
          'bg-surface text-fg-secondary border border-line hover:border-line-strong hover:bg-surface-hover hover:text-fg',
        ghost: 'text-fg-secondary hover:bg-surface-hover hover:text-fg',
        subtle: 'bg-surface-sunken text-fg-secondary hover:bg-surface-hover hover:text-fg',
        danger: 'bg-danger-soft text-danger-fg border border-danger/25 hover:bg-danger hover:text-white',
        outline:
          'border border-line bg-transparent text-fg-secondary hover:border-line-strong hover:text-fg hover:bg-surface-hover',
        link: 'text-brand hover:text-brand-hover underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        xs: 'h-7 px-2 text-2xs [&_svg]:size-3.5',
        sm: 'h-8 px-2.5 [&_svg]:size-3.5',
        md: 'h-9 px-3.5 [&_svg]:size-4',
        lg: 'h-10 px-4 text-sm [&_svg]:size-4',
        icon: 'size-9 [&_svg]:size-4',
        'icon-sm': 'size-8 [&_svg]:size-3.5',
        'icon-xs': 'size-7 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends ComponentPropsWithoutRef<'button'>,
    VariantProps<typeof button> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(button({ variant, size }), className)}
      {...props}
    />
  )
}

export { button as buttonVariants }
