/**
 * Centralised API layer.
 *
 * Contract
 * --------
 *  • Base URL comes from `VITE_API_BASE_URL` (falls back to same-origin).
 *  • `VITE_DEMO_MODE=true` short-circuits every call and serves the local
 *    warehouse instead, so the entire product is functional with Flask stopped.
 *  • Any network/5xx failure degrades to demo mode automatically — the UI
 *    never breaks because a backend is down; the header shows which mode is
 *    active.
 *
 * To wire a real Flask backend, implement the endpoints listed in
 * `docs/FRONTEND_API.md`; the TypeScript response shapes below are the
 * contract.
 */

import { toast } from 'sonner'

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const API_BASE = RAW_BASE.replace(/\/$/, '')

const env = import.meta.env as Record<string, string | boolean | undefined>
const FORCE_DEMO = String(env.VITE_DEMO_MODE ?? '').toLowerCase() === 'true'

export type ConnectionMode = 'probing' | 'live' | 'demo'

export const apiConfig = {
  baseUrl: API_BASE || '/api',
  rawBaseUrl: RAW_BASE,
  forceDemo: FORCE_DEMO,
  demoLatencyMs: Number(env.VITE_DEMO_LATENCY_MS ?? 260),
  requestTimeoutMs: Number(env.VITE_API_TIMEOUT_MS ?? 8000),
} as const

/* ------------------------------------------------------------------ *
 * Connection state (observable)
 * ------------------------------------------------------------------ */

let mode: ConnectionMode = FORCE_DEMO ? 'demo' : 'probing'
const listeners = new Set<(m: ConnectionMode) => void>()

export function getConnection(): ConnectionMode {
  return mode
}

export function onConnectionChange(fn: (m: ConnectionMode) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function setMode(next: ConnectionMode) {
  if (mode === next) return
  mode = next
  listeners.forEach((fn) => fn(next))
}

export class ApiError extends Error {
  readonly status: number
  readonly path: string

  constructor(message: string, status: number, path: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.path = path
  }
}

/* ------------------------------------------------------------------ *
 * Core request
 * ------------------------------------------------------------------ */

export type QueryValue = string | number | boolean | string[] | null | undefined

export function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (!value.length) continue
      search.set(key, value.join(','))
    } else {
      search.set(key, String(value))
    }
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

async function request<T>(
  path: string,
  init?: RequestInit,
  timeout = apiConfig.requestTimeoutMs,
): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(`${apiConfig.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })

    if (!res.ok) {
      throw new ApiError(`${path} responded ${res.status}`, res.status, path)
    }

    setMode('live')
    return (await res.json()) as T
  } finally {
    window.clearTimeout(timer)
  }
}

const delay = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

/**
 * `withFallback` is the single entry point every screen uses.
 * `fallback` is lazy — it only runs when the API is unavailable.
 */
export async function withFallback<T>(
  path: string,
  params: Record<string, QueryValue> | undefined,
  fallback: () => T,
  init?: RequestInit,
): Promise<T> {
  if (apiConfig.forceDemo) {
    if (mode !== 'demo') setMode('demo')
    if (apiConfig.demoLatencyMs > 0) await delay(Math.min(apiConfig.demoLatencyMs, 200))
    return fallback()
  }

  try {
    return await request<T>(`${path}${buildQuery(params)}`, init)
  } catch (error) {
    if (error instanceof ApiError && error.status < 500 && error.status !== 408 && error.status !== 429) {
      throw error
    }
    setMode('demo')
    return fallback()
  }
}

export function postFallback<T, B>(
  path: string,
  body: B,
  fallback: () => T,
): Promise<T> {
  return withFallback<T>(path, undefined, fallback, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/* ------------------------------------------------------------------ *
 * Health probe — drives the connection badge in the top bar.
 * ------------------------------------------------------------------ */

export interface HealthResponse {
  status: 'ok' | 'degraded'
  version: string
  warehouse: string
  rows: number
  models: number
}

export async function probeApi(): Promise<ConnectionMode> {
  if (apiConfig.forceDemo) {
    setMode('demo')
    return mode
  }
  try {
    await request<HealthResponse>('/health', undefined, 2500)
    setMode('live')
  } catch {
    setMode('demo')
  }
  return mode
}

/* ------------------------------------------------------------------ *
 * Endpoint map — one place to see the whole contract.
 * ------------------------------------------------------------------ */

export const endpoints = {
  health: '/health',
  overview: '/analytics/overview',
  kpis: '/analytics/kpis',
  series: '/analytics/series',
  carriers: '/analytics/carriers',
  warehouses: '/analytics/warehouses',
  countries: '/analytics/countries',
  insights: '/analytics/insights',
  orders: '/orders',
  order: (id: string) => `/orders/${id}`,
  olap: '/olap/query',
  dimensions: '/olap/dimensions',
  measures: '/olap/measures',
  predict: '/ml/predict',
  predictBatch: '/ml/predict/batch',
  modelMetadata: '/ml/models',
  modelMetrics: '/ml/models/metrics',
  featureImportance: '/ml/models/importance',
  quality: '/quality/report',
  platform: '/admin/status',
} as const

/* ------------------------------------------------------------------ *
 * Toasts — a thin wrapper so notifications read the same everywhere.
 * ------------------------------------------------------------------ */

export const notify = {
  success: (title: string, description?: string) =>
    toast.success(title, { description, className: 'logisense-toast' }),
  error: (title: string, description?: string) =>
    toast.error(title, { description, className: 'logisense-toast' }),
  info: (title: string, description?: string) =>
    toast(title, { description, className: 'logisense-toast' }),
  demo: () =>
    toast('Demo data in use', {
      description: 'VITE_DEMO_MODE is on — figures are served from the local warehouse.',
      className: 'logisense-toast',
    }),
}

export { API_BASE }
