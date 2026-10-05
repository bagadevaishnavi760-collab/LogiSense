export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function createRng(seed: string | number) {
  const rand = mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed)
  return {
    next: rand,
    int: (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min,
    float: (min: number, max: number, digits = 2) =>
      Number((rand() * (max - min) + min).toFixed(digits)),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)],
    bool: (p = 0.5) => rand() < p,
    /** Box–Muller normal sample. */
    normal: (mean = 0, sd = 1) => {
      const u = Math.max(rand(), 1e-9)
      const v = rand()
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    /** Weighted pick. */
    weighted: <T,>(entries: readonly (readonly [T, number])[]): T => {
      const total = entries.reduce((acc, [, w]) => acc + w, 0)
      let r = rand() * total
      for (const [value, w] of entries) {
        r -= w
        if (r <= 0) return value
      }
      return entries[entries.length - 1][0]
    },
  }
}

export type Rng = ReturnType<typeof createRng>

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function mean(values: readonly number[]): number {
  return values.length ? sum(values) / values.length : 0
}

export function percentile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return 0
  const idx = clamp(p, 0, 1) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export function median(values: readonly number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function groupBy<T, K extends string | number>(
  items: readonly T[],
  key: (item: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const bucket = map.get(k)
    if (bucket) bucket.push(item)
    else map.set(k, [item])
  }
  return map
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const escape = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return ''
    const s = String(value)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = rows.map((row) => row.map(escape).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
