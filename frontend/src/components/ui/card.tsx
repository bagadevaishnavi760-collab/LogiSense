import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '../../lib/cn'

/* ------------------------------------------------------------------ *
 * Panel — the single surface primitive.
 *
 * `flat` drops the border for use inside an already-bounded region,
 * `sunken` inverts the surface for embedded tables and code blocks.
 * ------------------------------------------------------------------ */

type Tone = 'default' | 'flat' | 'sunken' | 'inverse' | 'accent'

const tones: Record<Tone, string> = {
  default: 'bg-surface border-line shadow-hair',
  flat: 'bg-transparent border-transparent',
  sunken: 'bg-surface-sunken border-line',
  inverse: 'bg-surface-inverse border-transparent',
  accent: 'bg-brand-soft border-brand-line',
}

export interface PanelProps extends ComponentPropsWithoutRef<'section'> {
  tone?: Tone
  children: ReactNode
}

export function Panel({ className, tone = 'default', children, ...props }: PanelProps) {
  return (
    <section
      className={cn('rounded-lg border', tones[tone], className)}
      {...props}
    >
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Header — title, optional description, actions slot.
 * ------------------------------------------------------------------ */

export function PanelHeader({
  title,
  description,
  actions,
  icon,
  className,
  compact = false,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  className?: string
  compact?: boolean
  children?: ReactNode
}) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-4 border-b border-line-soft',
        compact ? 'px-4 py-2.5' : 'px-4 py-3 sm:px-5 sm:py-3.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-fg-subtle [&_svg]:size-4">{icon}</span> : null}
        <div className="min-w-0">
          <h3 className="truncate text-[13.5px] font-semibold leading-5 text-fg">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-4 text-fg-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      {children}
    </header>
  )
}

export function PanelBody({
  className,
  children,
  flush = false,
}: {
  className?: string
  children: ReactNode
  flush?: boolean
}) {
  return <div className={cn(flush ? '' : 'p-4 sm:p-5', className)}>{children}</div>
}

export function PanelFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <footer className={cn('flex items-center justify-between gap-3 border-t border-line-soft px-4 py-2.5', className)}>
      {children}
    </footer>
  )
}

/* ------------------------------------------------------------------ *
 * Section — page-level grouping. Not a card: hairline rule + eyebrow.
 * ------------------------------------------------------------------ */

export function Section({
  id,
  title,
  description,
  actions,
  children,
  className,
}: {
  id?: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn('flex flex-col gap-3.5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-fg-muted">{title}</h2>
          <span className="hidden h-px flex-1 bg-line sm:block" aria-hidden />
        </div>
        {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
      </div>
      {description ? <p className="-mt-2 text-xs text-fg-muted">{description}</p> : null}
      {children}
    </section>
  )
}
