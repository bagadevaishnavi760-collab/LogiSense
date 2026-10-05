/**
 * Chart theming.
 *
 * Colours come from the same CSS custom properties as the rest of the UI, so a
 * theme switch repaints charts without any JS involvement. Values are read at
 * render time from the computed style of the document root.
 */

export const SERIES = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
] as const

export const CATEGORICAL = SERIES

export const SEMANTIC = {
  brand: 'var(--color-brand)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  violet: 'var(--color-violet)',
  teal: 'var(--color-teal)',
  muted: 'var(--color-fg-subtle)',
  neutral: 'var(--color-chart-6)',
} as const

export const WEATHER_TONE: Record<string, keyof typeof SEMANTIC> = {
  Clear: 'success',
  Cloudy: 'info',
  Rain: 'brand',
  Snow: 'info',
  Storm: 'danger',
  'Extreme Heat': 'warning',
}

export function toneColor(tone: keyof typeof SEMANTIC | undefined): string {
  return SEMANTIC[tone ?? 'brand']
}

export const AXIS = {
  tick: { fill: 'var(--color-axis)', fontSize: 11 },
  axis: { stroke: 'var(--color-line)' },
  grid: { stroke: 'var(--color-grid)', vertical: false },
} as const

/** Deterministic pastel ramp for rating-style heatmaps. */
export function heatColor(value: number, max = 5): string {
  const t = Math.max(0, Math.min(1, value / max))
  if (t >= 0.8) return 'var(--color-success-soft)'
  if (t >= 0.6) return 'var(--color-teal-soft)'
  if (t >= 0.4) return 'var(--color-warning-soft)'
  return 'var(--color-danger-soft)'
}

export function riskColor(level: string): string {
  switch (level) {
    case 'Critical':
      return 'var(--color-danger)'
    case 'High':
      return 'var(--color-warning)'
    case 'Moderate':
      return 'var(--color-info)'
    default:
      return 'var(--color-success)'
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'Delivered':
      return 'var(--color-success)'
    case 'In Transit':
      return 'var(--color-info)'
    case 'Delayed':
      return 'var(--color-warning)'
    case 'Exception':
      return 'var(--color-danger)'
    case 'Returned':
      return 'var(--color-violet)'
    default:
      return 'var(--color-fg-subtle)'
  }
}

/** Gradient id helper — Recharts needs a unique id per <defs>. */
let uid = 0
export function gradientId(prefix = 'g'): string {
  uid += 1
  return `${prefix}-${uid}`
}
