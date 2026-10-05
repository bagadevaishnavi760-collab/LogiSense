import type { CSSProperties } from 'react'
import { cn } from '../../lib/cn'

/* ------------------------------------------------------------------ *
 * Skeletons — matched to real element geometry so loading never
 * shifts layout.
 * ------------------------------------------------------------------ */

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn('skeleton-sheen relative overflow-hidden rounded-sm bg-surface-sunken', className)}
    />
  )
}

export function SkeletonText({
  lines = 3,
  className,
  widths,
}: {
  lines?: number
  className?: string
  widths?: string[]
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={widths?.[i] ? { width: widths[i] } : undefined}
        />
      ))}
    </div>
  )
}

/** KPI tile placeholder. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-4', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="size-7 rounded-md" />
      </div>
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-9 w-full" />
    </div>
  )
}

export function SkeletonStatGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  )
}

const BAR_HEIGHTS = [64, 82, 45, 92, 70, 58, 88, 52, 74, 96, 61, 80, 67, 84]

export function SkeletonChart({ height = 240, className }: { height?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="flex items-end gap-2" style={{ height }}>
        {BAR_HEIGHTS.map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 8, columns = 7 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 border-b border-line bg-surface-sunken px-4 py-2.5">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line-soft px-4 py-3">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-3 flex-1" style={{ width: `${45 + ((r * 7 + c * 13) % 45)}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="flex-1">
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}
