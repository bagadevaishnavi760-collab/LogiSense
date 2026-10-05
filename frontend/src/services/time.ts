/**
 * Warehouse calendar helpers.
 *
 * The fact table is indexed by a zero-based day offset from 2026-01-01, which
 * keeps every bucket computation integer-only and free of timezone drift.
 */

export const YEAR = 2026
export const DAYS_IN_YEAR = 365

const EPOCH = Date.UTC(YEAR, 0, 1)

export function dayIndexOf(iso: string): number {
  const t = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(t)) return 0
  return Math.round((t - EPOCH) / 86400000)
}

export function indexToDate(index: number): string {
  return new Date(EPOCH + Math.max(0, Math.min(364, index)) * 86400000).toISOString().slice(0, 10)
}

export function dateRangeFor(days: number): { from: string; to: string } {
  return { from: indexToDate(365 - days), to: indexToDate(364) }
}

export function clampIndex(index: number): number {
  return Math.max(0, Math.min(DAYS_IN_YEAR - 1, Math.round(index)))
}

export function formatIso(index: number): string {
  return new Date(EPOCH + clampIndex(index) * 86400000).toISOString().slice(0, 10)
}

/** Inclusive list of ISO dates — used by the date-range picker. */
export function calendarDays(): string[] {
  return Array.from({ length: DAYS_IN_YEAR }, (_, i) => formatIso(i))
}
