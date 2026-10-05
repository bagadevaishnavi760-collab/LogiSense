import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export const TooltipProvider = ({
  children,
  delayDuration = 220,
  skipDelayDuration = 320,
}: {
  children: ReactNode
  delayDuration?: number
  skipDelayDuration?: number
}) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration}>
    {children}
  </TooltipPrimitive.Provider>
)

export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  align = 'center',
  ...props
}: TooltipPrimitive.TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className={cn(
          'z-[70] max-w-[280px] rounded-md border border-line bg-surface-raised px-2.5 py-1.5',
          'text-xs leading-[1.45] text-fg-secondary shadow-pop',
          'data-[state=delayed-open]:animate-fade-in data-[state=closed]:animate-fade-in',
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/** Convenience wrapper: `<Hint label="…"><Icon/></Hint>`. */
export function Hint({
  label,
  children,
  side = 'top',
}: {
  label: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
