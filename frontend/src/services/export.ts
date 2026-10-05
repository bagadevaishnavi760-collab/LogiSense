/**
 * Export helpers.
 *
 * Every "Export" button in the product routes through here so the CSV dialect,
 * file naming and escaping are identical everywhere.
 */

const NEEDS_QUOTE = /[",\n\r]/

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const s = String(value)
  return NEEDS_QUOTE.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Serialise an array of plain objects. Keys come from the first row. */
export function toCsv<T extends Record<string, unknown>>(rows: readonly T[]): string {
  if (!rows.length) return ''
  const columns = Object.keys(rows[0])
  const head = columns.join(',')
  const body = rows.map((row) => columns.map((c) => escapeCell(row[c])).join(','))
  return [head, ...body].join('\r\n')
}

/** Serialise an array of tuples. */
export function rowsToCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n')
}

/** Trigger a browser download. No-op outside the DOM. */
export function download(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  if (typeof document === 'undefined') return
  // BOM keeps Excel from mangling UTF-8 country names.
  const blob = new Blob([`\uFEFF${content}`], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportCsv(filename: string, content: string): void {
  download(filename, content)
}

export function exportJson<T>(filename: string, payload: T): void {
  download(filename, JSON.stringify(payload, null, 2), 'application/json')
}

/** Stable, sortable filename: `logisense-orders-2026-01-14.csv` */
export function stamp(prefix: string, isoDate = new Date().toISOString().slice(0, 10)): string {
  return `${prefix}-${isoDate}`
}