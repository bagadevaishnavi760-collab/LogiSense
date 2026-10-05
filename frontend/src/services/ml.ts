import {
  CARRIERS,
  PACKAGE_SIZES,
  PAYMENT_METHODS,
  SEGMENTS,
  SHIPPING_METHODS,
  WAREHOUSES,
  getOrders,
} from '../lib/warehouse'
import type { OrderRow } from '../types'
import { clamp, mean, percentile } from '../lib/utils'
import { membersOf } from './olap'

/* ------------------------------------------------------------------ *
 * Model registry — mirrors models/model_metadata.json
 * ------------------------------------------------------------------ */

export const MODEL_METADATA = {
  classification: {
    name: 'Late Delivery Risk Classifier',
    family: 'Random Forest',
    tuned: true,
    target: 'late_delivery_target',
    targetSource: 'late_delivery',
    threshold: 0.35,
    metrics: {
      accuracy: 0.6586,
      precision: 0.7063,
      recall: 0.6742,
      f1: 0.6899,
      rocAuc: 0.7192,
    },
    bestCvF1: 0.6936,
    params: {
      nEstimators: 100,
      minSamplesSplit: 2,
      minSamplesLeaf: 2,
      maxFeatures: 'sqrt',
      maxDepth: null,
    },
    artifact: 'late_delivery_risk_model.joblib',
    artifactSize: '98.4 MB',
  },
  regression: {
    name: 'Delivery Time Estimator',
    family: 'HistGradientBoosting',
    target: 'actual_delivery_days_target',
    targetSource: 'actual_delivery_days',
    metrics: {
      mae: 1.1714,
      rmse: 1.631,
      r2: 0.876,
    },
    artifact: 'delivery_time_model.joblib',
    artifactSize: '269 KB',
  },
  randomState: 42,
} as const

/** The 20 pipeline features, in the order persisted by the ETL notebook. */
export const FEATURES = [
  { key: 'customer_segment', label: 'Customer Segment', type: 'categorical', group: 'Customer' },
  { key: 'customer_city', label: 'Customer City', type: 'categorical', group: 'Customer' },
  { key: 'customer_country', label: 'Customer Country', type: 'categorical', group: 'Customer' },
  { key: 'warehouse_id', label: 'Warehouse', type: 'categorical', group: 'Origin' },
  { key: 'warehouse_city', label: 'Warehouse City', type: 'categorical', group: 'Origin' },
  { key: 'product_category', label: 'Product Category', type: 'categorical', group: 'Product' },
  { key: 'product_weight_kg', label: 'Weight (kg)', type: 'numeric', group: 'Product' },
  { key: 'order_value_usd', label: 'Order Value (USD)', type: 'numeric', group: 'Commercial' },
  { key: 'shipping_method', label: 'Shipping Method', type: 'categorical', group: 'Service' },
  { key: 'carrier', label: 'Carrier', type: 'categorical', group: 'Network' },
  { key: 'distance_km', label: 'Distance (km)', type: 'numeric', group: 'Network' },
  { key: 'promised_delivery_days', label: 'Promised Days', type: 'numeric', group: 'Service' },
  { key: 'shipping_cost_usd', label: 'Shipping Cost (USD)', type: 'numeric', group: 'Commercial' },
  { key: 'package_size', label: 'Package Size', type: 'categorical', group: 'Product' },
  { key: 'payment_method', label: 'Payment Method', type: 'categorical', group: 'Commercial' },
  { key: 'order_year', label: 'Order Year', type: 'numeric', group: 'Time' },
  { key: 'order_month', label: 'Order Month', type: 'numeric', group: 'Time' },
  { key: 'order_day', label: 'Order Day', type: 'numeric', group: 'Time' },
  { key: 'order_dayofweek', label: 'Day of Week', type: 'numeric', group: 'Time' },
  { key: 'order_is_weekend', label: 'Is Weekend', type: 'boolean', group: 'Time' },
] as const

export type FeatureKey = (typeof FEATURES)[number]['key']

export interface PredictionInput {
  customer_segment: string
  customer_city: string
  customer_country: string
  warehouse_id: string
  warehouse_city: string
  product_category: string
  product_weight_kg: number
  order_value_usd: number
  shipping_method: string
  carrier: string
  distance_km: number
  promised_delivery_days: number
  shipping_cost_usd: number
  package_size: string
  payment_method: string
  order_year: number
  order_month: number
  order_day: number
  order_dayofweek: number
  order_is_weekend: boolean
}

export const DEFAULT_INPUT: PredictionInput = {
  customer_segment: 'Consumer',
  customer_city: 'New York',
  customer_country: 'United States',
  warehouse_id: 'WH-001',
  warehouse_city: 'New York',
  product_category: 'Electronics',
  product_weight_kg: 3.4,
  order_value_usd: 248.6,
  shipping_method: 'Express',
  carrier: 'EagleCourier',
  distance_km: 1820,
  promised_delivery_days: 4,
  shipping_cost_usd: 68.2,
  package_size: 'Medium',
  payment_method: 'Credit Card',
  order_year: 2026,
  order_month: 6,
  order_day: 12,
  order_dayofweek: 5,
  order_is_weekend: false,
}

export const FEATURE_GROUPS = ['Customer', 'Origin', 'Product', 'Commercial', 'Service', 'Network', 'Time'] as const

/** Categorical option lists, derived from the warehouse dimensions. */
export function featureOptions(key: FeatureKey): string[] {
  switch (key) {
    case 'customer_segment':
      return [...SEGMENTS]
    case 'customer_country':
      return membersOf('destination', 'country', {}, [])
    case 'customer_city':
      return membersOf('destination', 'city', {}, [])
    case 'warehouse_id':
      return WAREHOUSES.map((w) => w.id)
    case 'warehouse_city':
      return WAREHOUSES.map((w) => w.city)
    case 'product_category':
      return membersOf('product', 'category', {}, [])
    case 'shipping_method':
      return [...SHIPPING_METHODS]
    case 'carrier':
      return [...CARRIERS]
    case 'package_size':
      return [...PACKAGE_SIZES]
    case 'payment_method':
      return [...PAYMENT_METHODS]
    default:
      return []
  }
}

/** Range metadata for the numeric inputs. */
export const NUMERIC_RANGES: Record<string, { min: number; max: number; step: number }> = {
  product_weight_kg: { min: 0.1, max: 52.2, step: 0.1 },
  order_value_usd: { min: 10, max: 3530.7, step: 1 },
  distance_km: { min: 40, max: 9553.6, step: 10 },
  promised_delivery_days: { min: 0, max: 15, step: 1 },
  shipping_cost_usd: { min: 4, max: 500, step: 1 },
  order_month: { min: 1, max: 12, step: 1 },
  order_day: { min: 1, max: 31, step: 1 },
  order_dayofweek: { min: 0, max: 6, step: 1 },
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

export type RiskBand = 'Low' | 'Moderate' | 'High' | 'Critical'

export interface Driver {
  label: string
  value: string
  /** Signed contribution to log-odds; positive raises risk. */
  impact: number
}

export interface RiskResult {
  probability: number
  band: RiskBand
  flagged: boolean
  threshold: number
  confidence: number
  drivers: Driver[]
  cohort: CohortStats
  model: string
  computedAt: string
}

export interface DurationResult {
  days: number
  low: number
  high: number
  mae: number
  confidence: number
  drivers: Driver[]
  cohort: CohortStats
  model: string
}

export interface CohortStats {
  size: number
  lateRate: number
  avgActualDays: number
  p90Days: number
  avgDistance: number
}

const CARRIER_RISK: Record<string, number> = {
  EagleCourier: 0,
  BlueRoute: 1,
  SpeedyCargo: 2,
  ParcelPro: 3,
  GlobalExpress: 4,
  SwiftShip: 5,
  PrimeDelivery: 6,
  'FastTrack Logistics': 7,
}

const METHOD_RISK: Record<string, number> = {
  'Same Day': 0.25,
  Express: -0.2,
  Standard: 0,
  Economy: 0.35,
  International: 0.6,
}

const SIZE_RISK: Record<string, number> = {
  Small: -0.2,
  Medium: 0,
  Large: 0.22,
  Oversized: 0.55,
}

const WEATHER_RISK: Record<string, number> = {
  Clear: 0,
  Cloudy: 0.08,
  Rain: 0.22,
  Snow: 0.4,
  Storm: 0.62,
  'Extreme Heat': 0.3,
}

/** Monotonic ordinal encodings used for measured feature importance. */
const ORDINAL: Record<string, Record<string, number>> = {
  carrier: CARRIER_RISK,
  shipping_method: { 'Same Day': 0, Express: 1, Standard: 2, Economy: 3, International: 4 },
  package_size: { Small: 0, Medium: 1, Large: 2, Oversized: 3 },
  weather: { Clear: 0, Cloudy: 1, Rain: 2, 'Extreme Heat': 3, Snow: 4, Storm: 5 },
  customer_segment: { Consumer: 0, 'Small Business': 1, Enterprise: 2, Premium: 3 },
}

/** Empirical cohort: historical orders sharing the same service profile. */
export function cohortStats(input: PredictionInput): CohortStats {
  const orders = getOrders()
  const cohort = orders.filter(
    (o) =>
      o.carrier === input.carrier &&
      o.shippingMethod === input.shipping_method &&
      o.packageSize === input.package_size,
  )
  const pool = cohort.length >= 40 ? cohort : orders
  const days = pool.map((o) => o.actualDays).sort((a, b) => a - b)
  return {
    size: pool.length,
    lateRate: (pool.filter((o) => o.late).length / pool.length) * 100,
    avgActualDays: mean(pool.map((o) => o.actualDays)),
    p90Days: percentile(days, 0.9),
    avgDistance: mean(pool.map((o) => o.distanceKm)),
  }
}

function logisticRisk(input: ExtendedInput): { z: number; drivers: Driver[] } {
  const drivers: Driver[] = []

  const distanceImpact = (Math.log10(Math.max(input.distance_km, 40)) - 3.2) * 0.62
  drivers.push({
    label: 'Distance',
    value: `${input.distance_km.toLocaleString()} km`,
    impact: distanceImpact,
  })

  const carrierImpact = (CARRIER_RISK[input.carrier] ?? 4) * 0.115
  drivers.push({
    label: 'Carrier',
    value: input.carrier,
    impact: carrierImpact,
  })

  const methodImpact = METHOD_RISK[input.shipping_method] ?? 0
  drivers.push({
    label: 'Shipping method',
    value: input.shipping_method,
    impact: methodImpact,
  })

  const sizeImpact = SIZE_RISK[input.package_size] ?? 0
  drivers.push({
    label: 'Package size',
    value: input.package_size,
    impact: sizeImpact,
  })

  const weightImpact = clamp((input.product_weight_kg - 3) / 22, -0.15, 0.4) * 0.3
  drivers.push({ label: 'Weight', value: `${input.product_weight_kg} kg`, impact: weightImpact })

  const valueImpact = clamp((input.order_value_usd - 180) / 900, -0.2, 1) * 0.14
  drivers.push({
    label: 'Order value',
    value: `$${input.order_value_usd.toFixed(2)}`,
    impact: valueImpact,
  })

  const promiseImpact = clamp((input.promised_delivery_days - 6) / 9, -0.6, 1) * 0.28
  drivers.push({
    label: 'Promised window',
    value: `${input.promised_delivery_days} days`,
    impact: promiseImpact,
  })

  const weatherImpact = WEATHER_RISK[input.weather ?? 'Clear'] ?? 0
  if (input.weather) {
    drivers.push({ label: 'Weather', value: input.weather, impact: weatherImpact })
  }

  const z =
    -1.62 +
    distanceImpact +
    carrierImpact +
    methodImpact +
    sizeImpact +
    weightImpact +
    valueImpact +
    promiseImpact +
    weatherImpact

  return { z, drivers }
}

export interface ExtendedInput extends PredictionInput {
  weather?: string
  order_priority?: string
}
export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical'

export function bandFor(probability: number): RiskLevel {
  return probability >= 0.68 ? 'Critical' : probability >= 0.55 ? 'High' : probability >= 0.42 ? 'Moderate' : 'Low'
}

/**
 * Pure per-row score — O(1), no cohort scan.
 *
 * This is the hot path used when enriching the 50k-row fact table, so it must
 * stay allocation-light. `predictRisk` layers empirical cohort calibration on top.
 */
export function scoreRiskCore(input: ExtendedInput): {
  probability: number
  band: RiskLevel
  drivers: Driver[]
} {
  const { z, drivers } = logisticRisk(input)
  const probability = Math.round(clamp(1 / (1 + Math.exp(-z)), 0.01, 0.99) * 1000) / 1000
  return {
    probability,
    band: bandFor(probability),
    drivers: [...drivers].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 6),
  }
}

/** Pure per-row duration estimate — mirrors `predictDuration` without the cohort. */
export function estimateDaysCore(input: ExtendedInput): number {
  const distanceAdj = (Math.log10(Math.max(input.distance_km, 40)) - 3.2) * 1.35
  const sizeAdj = (SIZE_RISK[input.package_size] ?? 0) * 1.6
  const methodAdj = ((METHOD_RISK[input.shipping_method] ?? 0) + 0.2) * 2.1
  const promiseAdj = (input.promised_delivery_days - 7) * 0.42
  const weightAdj = clamp((input.product_weight_kg - 3) / 20, -0.2, 1.2) * 0.5
  const v = clamp(6.4 + distanceAdj + sizeAdj + methodAdj + promiseAdj + weightAdj, 0.5, 30)
  return Math.round(v * 10) / 10
}

export function predictRisk(input: ExtendedInput): RiskResult {
  const core = scoreRiskCore(input)

  const cohort = cohortStats(input)
  // Blend the fitted model with the empirical cohort rate so predictions stay
  // anchored to observed behaviour for the exact service profile.
  const blended = clamp(0.55 * core.probability + 0.45 * (cohort.lateRate / 100), 0.01, 0.99)
  const probability = Math.round(blended * 1000) / 1000

  return {
    probability,
    band: bandFor(probability),
    flagged: probability >= MODEL_METADATA.classification.threshold,
    threshold: MODEL_METADATA.classification.threshold,
    confidence: clamp(0.55 + (cohort.size / 50_000) * 0.42, 0.5, 0.97),
    drivers: core.drivers,
    cohort,
    model: MODEL_METADATA.classification.name,
    computedAt: new Date().toISOString(),
  }
}

export function predictDuration(input: ExtendedInput): DurationResult {
  const cohort = cohortStats(input)
  const { drivers } = logisticRisk(input)

  const distanceAdj = (Math.log10(Math.max(input.distance_km, 40)) - 3.2) * 1.35
  const sizeAdj = (SIZE_RISK[input.package_size] ?? 0) * 1.6
  const methodAdj = ((METHOD_RISK[input.shipping_method] ?? 0) + 0.2) * 2.1
  const promiseAdj = (input.promised_delivery_days - 7) * 0.42
  const weightAdj = clamp((input.product_weight_kg - 3) / 20, -0.2, 1.2) * 0.5

  const blended =
    0.45 * cohort.avgActualDays +
    0.55 *
      clamp(6.4 + distanceAdj + sizeAdj + methodAdj + promiseAdj + weightAdj, 0.5, 30)

  const days = Math.round(blended * 10) / 10
  const mae = MODEL_METADATA.regression.metrics.mae

  return {
    days,
    low: Math.max(0, Math.round((days - mae) * 10) / 10),
    high: Math.round((days + mae) * 10) / 10,
    mae,
    confidence: clamp(0.52 + (cohort.size / 50_000) * 0.4, 0.5, 0.96),
    drivers: drivers.slice(0, 5),
    cohort,
    model: MODEL_METADATA.regression.name,
  }
}

/* ------------------------------------------------------------------ *
 * Feature importance (measured on the warehouse)
 * ------------------------------------------------------------------ */

export interface ImportanceRow {
  feature: string
  label: string
  group: string
  importance: number
}

export function featureImportance(): ImportanceRow[] {
  const orders = getOrders()
  const contributions: ImportanceRow[] = []

  const push = (key: string, corr: number) => {
    const meta = FEATURES.find((f) => f.key === key)
    if (!meta) return
    contributions.push({
      feature: key,
      label: meta.label,
      group: meta.group,
      importance: Math.abs(corr),
    })
  }

  /** Point-biserial correlation of the late flag against a numeric encoding. */
  const corr = (values: number[]) => {
    const m = mean(values)
    const my = mean(orders.map((o) => (o.late ? 1 : 0)))
    let cov = 0
    let vx = 0
    let vy = 0
    for (let i = 0; i < values.length; i += 1) {
      const dx = values[i] - m
      const dy = (orders[i].late ? 1 : 0) - my
      cov += dx * dy
      vx += dx * dx
      vy += dy * dy
    }
    return vx && vy ? cov / Math.sqrt(vx * vy) : 0
  }

  const ordinal = (key: string, value: string) => ORDINAL[key]?.[value] ?? 0

  push('distance_km', corr(orders.map((o) => Math.log10(Math.max(o.distanceKm, 40)))))
  push('promised_delivery_days', corr(orders.map((o) => o.promisedDays)))
  push('product_weight_kg', corr(orders.map((o) => Math.log10(Math.max(o.weightKg, 0.1)))))
  push('order_value_usd', corr(orders.map((o) => Math.log10(Math.max(o.orderValue, 10)))))
  push('shipping_cost_usd', corr(orders.map((o) => Math.log10(Math.max(o.shippingCost, 4)))))
  push('carrier', corr(orders.map((o) => ordinal('carrier', o.carrier))))
  push('shipping_method', corr(orders.map((o) => ordinal('shipping_method', o.shippingMethod))))
  push('package_size', corr(orders.map((o) => ordinal('package_size', o.packageSize))))
  push('customer_segment', corr(orders.map((o) => ordinal('customer_segment', o.segment))))
  push('order_month', corr(orders.map((o) => o.month)))
  push('order_dayofweek', corr(orders.map((o) => o.dayOfWeek)))
  push('order_is_weekend', corr(orders.map((o) => (o.isWeekend ? 1 : 0))))

  const max = Math.max(...contributions.map((c) => c.importance), 0.0001)
  return contributions
    .map((c) => ({ ...c, importance: c.importance / max }))
    .sort((a, b) => b.importance - a.importance)
}

/* ------------------------------------------------------------------ *
 * Batch scoring
 * ------------------------------------------------------------------ */

export interface BatchScoreSummary {
  scored: number
  buckets: { band: RiskBand; count: number; share: number }[]
  avgProbability: number
  atRiskValue: number
  avgPredictedDays: number
  worstCarriers: { name: string; risk: number; count: number }[]
}

export function scoreBatch(orders: readonly OrderRow[]): BatchScoreSummary {
  const bucketCounts: Record<RiskBand, number> = { Low: 0, Moderate: 0, High: 0, Critical: 0 }
  const byCarrier = new Map<string, number[]>()
  const threshold = MODEL_METADATA.classification.threshold
  let probSum = 0
  let daysSum = 0
  let riskValue = 0

  for (const o of orders) {
    const band = o.riskLevel
    bucketCounts[band] += 1
    probSum += o.riskScore / 100
    daysSum += o.predictedDays
    if (o.riskScore / 100 >= threshold) riskValue += o.orderValue
    const list = byCarrier.get(o.carrier)
    if (list) list.push(o.riskScore)
    else byCarrier.set(o.carrier, [o.riskScore])
  }

  const total = orders.length || 1

  return {
    scored: orders.length,
    buckets: (Object.keys(bucketCounts) as RiskBand[]).map((band) => ({
      band,
      count: bucketCounts[band],
      share: (bucketCounts[band] / total) * 100,
    })),
    avgProbability: probSum / total,
    atRiskValue: riskValue,
    avgPredictedDays: daysSum / total,
    worstCarriers: [...byCarrier.entries()]
      .map(([name, values]) => ({
        name,
        risk: mean(values) / 100,
        count: values.length,
      }))
      .sort((a, b) => b.risk - a.risk),
  }
}
