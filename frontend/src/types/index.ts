import type { Order } from '../lib/warehouse'

/* ------------------------------------------------------------------ *
 * Filters
 * ------------------------------------------------------------------ */

export interface Filters {
  from: string
  to: string
  carriers: string[]
  warehouses: string[]
  countries: string[]
  segments: string[]
  categories: string[]
  shippingMethods: string[]
}

export interface DatePreset {
  id: string
  label: string
  short: string
  days: number
}

export interface FilterMeta {
  key: Exclude<keyof Filters, 'from' | 'to'>
  label: string
  options: readonly string[]
}

/* ------------------------------------------------------------------ *
 * Measures / series
 * ------------------------------------------------------------------ */

export type ValueFormat =
  | 'number'
  | 'compact'
  | 'currency'
  | 'compactCurrency'
  | 'percent'
  | 'days'
  | 'km'
  | 'kg'
  | 'rating'
  | 'score'

export interface Kpi {
  key: string
  label: string
  value: number
  format: ValueFormat
  delta: number
  deltaLabel: string
  higherIsBetter: boolean
  spark: number[]
  hint: string
}

export interface TimePoint {
  label: string
  fullLabel: string
  orders: number
  onTime: number
  late: number
  revenue: number
  shippingCost: number
  avgDays: number
  lateRate: number
  onTimeRate: number
  avgDistance: number
}

export interface RankRow {
  name: string
  orders: number
  revenue: number
  shippingCost: number
  avgDays: number
  promisedDays: number
  lateRate: number
  onTimeRate: number
  avgDistance: number
  returnRate: number
  avgRating: number
  costPerOrder: number
  marginPct: number
}

export interface GeoRow {
  country: string
  orders: number
  revenue: number
  avgDays: number
  lateRate: number
  avgDistance: number
}

export interface Slice {
  name: string
  value: number
  count: number
  color: 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'violet' | 'teal'
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'teal' | 'brand'

export interface Insight {
  id: string
  tone: Tone
  eyebrow: string
  title: string
  body: string
  metric: string
  metricLabel: string
}

export interface OverviewData {
  kpis: Kpi[]
  series: TimePoint[]
  carriers: RankRow[]
  countries: GeoRow[]
  warehouses: RankRow[]
  statusSplit: Slice[]
  riskSplit: Slice[]
  categories: RankRow[]
  segments: RankRow[]
  insights: Insight[]
  generatedAt: string
  totalOrders: number
}

/* ------------------------------------------------------------------ *
 * Machine / platform
 * ------------------------------------------------------------------ */

export type HealthState = 'operational' | 'degraded' | 'outage' | 'maintenance'

export interface ServiceStatus {
  id: string
  name: string
  group: string
  description: string
  state: HealthState
  latencyMs: number | null
  uptime: number
  detail: string
}

export interface PipelineStep {
  id: string
  name: string
  layer: 'Extract' | 'Transform' | 'Load' | 'Model' | 'Serve'
  state: HealthState
  durationMs: number
  rows: number
  ranAt: string
  detail: string
}

export interface MetricPoint {
  label: string
  value: number
  lower?: number
  upper?: number
}

export interface DriftPoint {
  label: string
  psi: number
  baseline: number
}

export interface ColumnHealth {
  column: string
  dtype: string
  completeness: number
  nulls: number
  distinct: number
  outliers: number
  uniqueness: number
  mean: number | null
  std: number | null
  min: number | null
  max: number | null
  status: 'healthy' | 'watch' | 'risk'
  note: string
}

export interface QualityIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  rows: number
  column: string
  resolution: string
}

export interface ResourceSample {
  label: string
  value: number
  unit: string
}

/* ------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------ */

export type OrderStatus = 'Delivered' | 'In Transit' | 'Delayed' | 'Returned' | 'Exception'

export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical'

export interface OrderRow extends Order {
  customerId: string
  riskScore: number
  riskLevel: RiskLevel
  predictedDays: number
}

export type { Order }
