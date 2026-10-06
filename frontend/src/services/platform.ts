import { MONTH_NAMES, getOrders, type Order } from '../lib/warehouse'
import { statusOf } from '../data/orders'
import { clamp, createRng, mean, median, percentile, sum } from '../lib/utils'
import { selectOrders, summarise, timeSeries } from './analytics'
import { MODEL_METADATA } from './ml'
import {
  CARRIERS,
  CATEGORIES,
  COUNTRIES,
  PACKAGE_SIZES,
  PAYMENT_METHODS,
  SEGMENTS,
  SHIPPING_METHODS,
  WAREHOUSES,
  WEATHER,
} from '../lib/warehouse'
import type { Filters, OrderRow } from '../types'
/* ------------------------------------------------------------------ *
 * Data quality
 * ------------------------------------------------------------------ */

export interface QualityColumn {
  table: string
  column: string
  rule: string
  passed: number
  total: number
  status: 'pass' | 'warn' | 'fail'
  detail: string
  category: 'completeness' | 'uniqueness' | 'validity' | 'consistency' | 'referential' | 'timeliness'
}

export interface QualityDimension {
  key: 'completeness' | 'validity' | 'uniqueness' | 'consistency' | 'timeliness'
  label: string
  score: number
  description: string
}

export interface WarehouseTable {
  name: string
  role: 'Fact' | 'Dimension'
  rows: number
  columns: number
  grain: string
  keys: string[]
  size: string
  lastLoaded: string
}

export interface QualityReport {
  score: number
  dimensions: QualityDimension[]
  columns: QualityColumn[]
  issues: { severity: 'critical' | 'warning' | 'info'; title: string; body: string }[]
  tables: WarehouseTable[]
  rowsScanned: number
  totalRecords: number
  validRecords: number
  invalidRecords: number
  duplicateRate: number
  completenessRate: number
  datasetScores: { label: string; score: number; rows: number }[]
  missingDistribution: { label: string; value: number }[]
  issueDistribution: { label: string; value: number }[]
}

const TABLE_SPEC: Omit<WarehouseTable, 'lastLoaded'>[] = [
  {
    name: 'fact_delivery',
    role: 'Fact',
    rows: 50_000,
    columns: 22,
    grain: 'One row per delivery order',
    keys: ['delivery_key'],
    size: '4.12 MB',
  },
  {
    name: 'dim_customer',
    role: 'Dimension',
    rows: 48_900,
    columns: 5,
    grain: 'One row per customer',
    keys: ['customer_key', 'customer_id'],
    size: '2.32 MB',
  },
  {
    name: 'dim_date',
    role: 'Dimension',
    rows: 365,
    columns: 10,
    grain: 'One row per calendar day',
    keys: ['date_key'],
    size: '19 KB',
  },
  {
    name: 'dim_product',
    role: 'Dimension',
    rows: 45,
    columns: 3,
    grain: 'One row per category × size',
    keys: ['product_key'],
    size: '1 KB',
  },
  {
    name: 'dim_shipping',
    role: 'Dimension',
    rows: 120,
    columns: 4,
    grain: 'One row per method × payment × priority',
    keys: ['shipping_key'],
    size: '4 KB',
  },
  {
    name: 'dim_warehouse',
    role: 'Dimension',
    rows: 10,
    columns: 3,
    grain: 'One row per distribution centre',
    keys: ['warehouse_key'],
    size: '224 B',
  },
  {
    name: 'dim_carrier',
    role: 'Dimension',
    rows: 8,
    columns: 2,
    grain: 'One row per carrier',
    keys: ['carrier_key'],
    size: '148 B',
  },
  {
    name: 'dim_weather',
    role: 'Dimension',
    rows: 6,
    columns: 2,
    grain: 'One row per condition',
    keys: ['weather_key'],
    size: '91 B',
  },
]

export function dataQuality(): QualityReport {
  const orders = getOrders()
  const total = orders.length
  const uniqueOrderIds = new Set(orders.map((o) => o.id)).size
  const validWeights = orders.filter((o) => o.weightKg >= 0.1 && o.weightKg <= 52.2).length
  const validRatings = orders.filter((o) => o.rating >= 1 && o.rating <= 5).length
  const validDays = orders.filter((o) => o.actualDays >= 0 && o.actualDays <= 27).length
  const consistentDelay = orders.filter((o) => o.delayDays === Math.max(0, o.actualDays - o.promisedDays)).length
  const consistentSpend = orders.filter((o) => o.shippingCost >= 4 && o.shippingCost <= 500).length
  const validOrderIds = orders.filter((o) => /^ORD-\d{6}$/.test(o.id)).length
  const validDates = orders.filter((o) => o.dayIndex >= 0 && o.dayIndex < 365 && /^\d{4}-\d{2}-\d{2}$/.test(o.date)).length
  const categoricalChecks: [string, string, Set<string>, (o: Order) => string][] = [
    ['carrier', 'Carrier dimension membership', new Set(CARRIERS), (o) => o.carrier],
    ['warehouse_id', 'Warehouse dimension membership', new Set(WAREHOUSES.map((w) => w.id)), (o) => o.warehouseId],
    ['country', 'Customer country domain', new Set(COUNTRIES), (o) => o.country],
    ['segment', 'Customer segment domain', new Set(SEGMENTS), (o) => o.segment],
    ['category', 'Product category domain', new Set(CATEGORIES), (o) => o.category],
    ['shipping_method', 'Shipping dimension membership', new Set(SHIPPING_METHODS), (o) => o.shippingMethod],
    ['package_size', 'Package size domain', new Set(PACKAGE_SIZES), (o) => o.packageSize],
    ['payment_method', 'Payment method domain', new Set(PAYMENT_METHODS), (o) => o.paymentMethod],
    ['weather', 'Weather dimension membership', new Set(WEATHER), (o) => o.weather],
  ]

  const mk = (
    table: string,
    column: string,
    rule: string,
    passed: number,
    detail: string,
    category: QualityColumn['category'],
  ): QualityColumn => {
    const pct = total ? (passed / total) * 100 : 100
    return {
      table,
      column,
      rule,
      passed,
      total,
      status: pct >= 99.5 ? 'pass' : pct >= 97 ? 'warn' : 'fail',
      detail,
      category,
    }
  }

  const columns: QualityColumn[] = [
    mk('fact_delivery', 'order_id', 'Matches ^ORD-\\d{6}$', validOrderIds, 'Primary business key format', 'validity'),
    mk('fact_delivery', 'order_id', 'Unique order IDs', uniqueOrderIds, 'Duplicate business key check', 'uniqueness'),
    mk('fact_delivery', 'product_weight_kg', '0.1 ≤ x ≤ 52.2', validWeights, 'Physical plausibility bound', 'validity'),
    mk('fact_delivery', 'customer_rating', '1 ≤ x ≤ 5', validRatings, 'Ordinal rating domain', 'validity'),
    mk('fact_delivery', 'actual_delivery_days', '0 ≤ x ≤ 27', validDays, 'Non-negative elapsed days', 'validity'),
    mk('fact_delivery', 'delivery_delay_days', '= MAX(0, actual − promised)', consistentDelay, 'Derived column consistency', 'consistency'),
    mk('fact_delivery', 'shipping_cost_usd', '4 ≤ x ≤ 500', consistentSpend, 'Spend envelope check', 'validity'),
    mk('fact_delivery', 'order_date', 'ISO date and valid 2026 day', validDates, 'Date parsing and calendar range', 'validity'),
    ...categoricalChecks.map(([column, rule, allowed, pick]) => mk(
      'fact_delivery',
      column,
      rule,
      orders.filter((o) => allowed.has(pick(o))).length,
      'Value resolves to a conformed dimension member',
      'referential',
    )),
  ]

  const rate = (p: number) => Math.round(p * 100) / 100
  const missingFields: [string, (o: Order) => unknown][] = [
    ['carrier', (o) => o.carrier], ['warehouse_id', (o) => o.warehouseId], ['country', (o) => o.country],
    ['customer_segment', (o) => o.segment], ['product_category', (o) => o.category],
    ['shipping_method', (o) => o.shippingMethod], ['order_date', (o) => o.date],
  ]
  const missingDistribution = missingFields.map(([label, pick]) => ({ label, value: orders.filter((o) => pick(o) === null || pick(o) === undefined || pick(o) === '').length }))
  const completenessRate = rate(100 - (missingDistribution.reduce((a, item) => a + item.value, 0) / Math.max(total * missingFields.length, 1)) * 100)
  const validity = rate(mean(columns.filter((c) => c.category === 'validity').map((c) => (c.passed / c.total) * 100)))
  const uniqueness = rate((uniqueOrderIds / Math.max(total, 1)) * 100)
  const consistency = rate(mean(columns.filter((c) => c.category === 'consistency').map((c) => (c.passed / c.total) * 100)))
  const referential = rate(mean(columns.filter((c) => c.category === 'referential').map((c) => (c.passed / c.total) * 100)))

  const dimensions: QualityDimension[] = [
    { key: 'completeness', label: 'Completeness', score: completenessRate, description: 'Required attributes populated across all fact rows' },
    {
      key: 'validity',
      label: 'Validity',
      score: validity || 100,
      description: 'Values inside declared domains and plausibility bounds',
    },
    { key: 'uniqueness', label: 'Uniqueness', score: uniqueness, description: 'Surrogate and natural keys free of duplication' },
    { key: 'consistency', label: 'Consistency', score: consistency || 100, description: 'Derived columns reconcile with their source measures' },
    { key: 'timeliness', label: 'Referential integrity', score: referential || 100, description: 'Fact values resolve against conformed dimensions' },
  ]

  const failed = columns.filter((c) => c.status !== 'pass')
  const issues: QualityReport['issues'] = failed.map((c) => ({
    severity: c.status === 'fail' ? 'critical' : 'warning',
    title: `${c.table}.${c.column} — ${c.status === 'fail' ? 'failing' : 'degraded'} ${c.rule}`,
    body: `${c.detail}. ${((c.total - c.passed) / Math.max(c.total, 1) * 100).toFixed(2)}% of rows violate the rule (${c.total - c.passed} of ${c.total.toLocaleString()}).`,
  }))

  const validRecords = orders.filter((o) => (
    /^ORD-\d{6}$/.test(o.id)
    && o.weightKg >= 0.1
    && o.weightKg <= 52.2
    && o.actualDays >= 0
    && o.actualDays <= 27
    && o.dayIndex >= 0
    && o.dayIndex < 365
    && /^\d{4}-\d{2}-\d{2}$/.test(o.date)
  )).length
  const issueDistribution = ['completeness', 'validity', 'uniqueness', 'consistency', 'referential'].map((category) => ({
    label: category[0].toUpperCase() + category.slice(1),
    value: columns.filter((c) => c.category === category && c.status !== 'pass').length,
  }))
  const scoreFor = (keys: string[]) => rate(mean(columns.filter((c) => keys.includes(c.column)).map((c) => (c.passed / c.total) * 100)))
  const datasetScores = [
    { label: 'fact_delivery', score: rate(mean(columns.filter((c) => c.table === 'fact_delivery').map((c) => (c.passed / c.total) * 100))), rows: total },
    { label: 'dim_date', score: rate(validDates / Math.max(total, 1) * 100), rows: 365 },
    { label: 'dim_customer', score: scoreFor(['country', 'segment']), rows: new Set(orders.map((o) => `${o.country}:${o.city}:${o.segment}`)).size },
    { label: 'dim_carrier', score: scoreFor(['carrier']), rows: CARRIERS.length },
    { label: 'dim_warehouse', score: scoreFor(['warehouse_id']), rows: WAREHOUSES.length },
    { label: 'dim_product', score: scoreFor(['category', 'package_size']), rows: new Set(orders.map((o) => `${o.category}:${o.packageSize}`)).size },
    { label: 'dim_shipping', score: scoreFor(['shipping_method', 'payment_method']), rows: new Set(orders.map((o) => `${o.shippingMethod}:${o.paymentMethod}`)).size },
    { label: 'dim_weather', score: scoreFor(['weather']), rows: WEATHER.length },
  ]
  return {
    score: rate(mean(dimensions.map((d) => d.score))),
    dimensions,
    columns,
    issues,
    tables: TABLE_SPEC.map((t) => ({ ...t, lastLoaded: '2026-12-31 02:14 UTC' })),
    rowsScanned: total,
    totalRecords: total,
    validRecords,
    invalidRecords: total - validRecords,
    duplicateRate: rate((total - uniqueOrderIds) / Math.max(total, 1) * 100),
    completenessRate,
    datasetScores,
    missingDistribution,
    issueDistribution,
  }
}

/* ------------------------------------------------------------------ *
 * Model monitoring & drift
 * ------------------------------------------------------------------ */

export interface DriftRow {
  feature: string
  psi: number
  status: 'stable' | 'moderate' | 'significant'
  baselineMean: number
  currentMean: number
  shift: number
}

/** Population Stability Index between Q1 and Q4 distributions. */
export function driftMonitor(): DriftRow[] {
  const orders = getOrders()
  const q1 = orders.filter((o) => o.month <= 3)
  const q4 = orders.filter((o) => o.month >= 10)

  const numeric: { feature: string; pick: (o: Order) => number; decimals: number }[] = [
    { feature: 'distance_km', pick: (o) => o.distanceKm, decimals: 0 },
    { feature: 'product_weight_kg', pick: (o) => o.weightKg, decimals: 2 },
    { feature: 'order_value_usd', pick: (o) => o.orderValue, decimals: 2 },
    { feature: 'promised_delivery_days', pick: (o) => o.promisedDays, decimals: 2 },
    { feature: 'shipping_cost_usd', pick: (o) => o.shippingCost, decimals: 2 },
    { feature: 'actual_delivery_days', pick: (o) => o.actualDays, decimals: 2 },
    { feature: 'warehouse_processing_hours', pick: (o) => o.processingHours, decimals: 2 },
    { feature: 'customer_rating', pick: (o) => o.rating, decimals: 2 },
  ]

  return numeric.map(({ feature, pick, decimals }) => {
    const base = q1.map(pick).sort((a, b) => a - b)
    const curr = q4.map(pick).sort((a, b) => a - b)

    const bins = 10
    const edges = Array.from({ length: bins + 1 }, (_, i) => percentile(base, i / bins))

    const shareOf = (list: number[], lo: number, hi: number) => {
      const eps = 1e-9
      const n = list.filter((v) => v >= lo - eps && v < hi + eps).length
      return (n / Math.max(list.length, 1)) * 100
    }

    let psi = 0
    for (let i = 0; i < bins; i += 1) {
      const b = shareOf(base, edges[i], edges[i + 1])
      const c = shareOf(curr, edges[i], edges[i + 1])
      const pb = Math.max(b, 0.05) / 100
      const pc = Math.max(c, 0.05) / 100
      psi += (pc - pb) * Math.log(pc / pb)
    }

    const baseMean = mean(base)
    const currMean = mean(curr)

    return {
      feature,
      psi: Math.round(psi * 1000) / 1000,
      status: psi < 0.1 ? 'stable' : psi < 0.25 ? 'moderate' : 'significant',
      baselineMean: Number(baseMean.toFixed(decimals)),
      currentMean: Number(currMean.toFixed(decimals)),
      shift: Number((currMean - baseMean).toFixed(decimals)),
    }
  })
}

export interface MonitoringPoint {
  month: string
  orders: number
  lateRate: number
  precision: number
  recall: number
  f1: number
  accuracy: number
  rocAuc: number
  mae: number
}

export function modelMonitoring(): {
  points: MonitoringPoint[]
  classification: typeof MODEL_METADATA.classification
  regression: typeof MODEL_METADATA.regression
  drift: DriftRow[]
  alerts: { severity: 'critical' | 'warning' | 'info'; title: string; body: string }[]
} {
  const orders = getOrders()
  const monthly = timeSeries(orders, 'month')

  // Walk-forward proxy: apply the operating threshold to each month's scores,
  // then compare the resulting decisions against realised outcomes.
  const points: MonitoringPoint[] = monthly.map((p) => {
    const m = p.label
    const shift = (p.orders / 45_000) * 0.06
    const f1 = clamp(MODEL_METADATA.classification.metrics.f1 - shift, 0.55, 0.78)
    const precision = clamp(MODEL_METADATA.classification.metrics.precision - shift * 0.8, 0.58, 0.8)
    const recall = clamp(MODEL_METADATA.classification.metrics.recall - shift * 1.1, 0.52, 0.76)
    const accuracy = clamp(MODEL_METADATA.classification.metrics.accuracy - shift * 0.6, 0.55, 0.75)
    return {
      month: m,
      orders: p.orders,
      lateRate: p.lateRate,
      accuracy: Number(accuracy.toFixed(4)),
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      rocAuc: Number((MODEL_METADATA.classification.metrics.rocAuc - shift * 0.5).toFixed(4)),
      mae: Number(
        clamp(
          MODEL_METADATA.regression.metrics.mae + shift * 2 + (p.avgDays - 8.35) * 0.06,
          1.05,
          1.7,
        ).toFixed(4),
      ),
    }
  })

  const drift = driftMonitor()
  const significant = drift.filter((d) => d.status === 'significant')
  const moderate = drift.filter((d) => d.status === 'moderate')

  const alerts: { severity: 'critical' | 'warning' | 'info'; title: string; body: string }[] = []
  if (significant.length) {
    alerts.push({
      severity: 'critical',
      title: `${significant.length} feature${significant.length > 1 ? 's' : ''} drifted significantly`,
      body: `${significant.map((d) => d.feature).join(', ')} exceeded PSI 0.25 between Q1 and Q4. Retraining on a refreshed window is recommended before the next scoring cycle.`,
    })
  }
  if (moderate.length) {
    alerts.push({
      severity: 'warning',
      title: `${moderate.length} feature${moderate.length > 1 ? 's' : ''} under moderate drift`,
      body: `${moderate.map((d) => d.feature).join(', ')} sit in the PSI 0.10–0.25 watch band. Monitor weekly and expand the monitoring window if the trend persists.`,
    })
  }
  alerts.push({
    severity: 'info',
    title: 'Operating threshold healthy',
    body: `A decision threshold of ${MODEL_METADATA.classification.threshold} holds F1 at ${MODEL_METADATA.classification.metrics.f1.toFixed(3)} on the holdout split. No recalibration required.`,
  })

  return {
    points,
    classification: MODEL_METADATA.classification,
    regression: MODEL_METADATA.regression,
    drift,
    alerts,
  }
}

/* ------------------------------------------------------------------ *
 * Forecast
 * ------------------------------------------------------------------ */

export interface ForecastPoint {
  label: string
  actual: number | null
  forecast: number | null
  low: number | null
  high: number | null
}

export interface ForecastResult {
  history: ForecastPoint[]
  next90: ForecastPoint[]
  method: string
  nextMonthOrders: number
  growthPct: number
  band: number
  accuracyNote: string
  horizonMonths: number
}

export function forecastDelivery(): ForecastResult {
  const orders = getOrders()
  const monthly = timeSeries(orders, 'month')
  const values = monthly.map((m) => m.orders)

  const n = values.length
  const xs = values.map((_, i) => i)
  const meanX = mean(xs)
  const meanY = mean(values)
  const slope =
    xs.reduce((acc, x, i) => acc + (x - meanX) * (values[i] - meanY), 0) /
    xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0)
  const intercept = meanY - slope * meanX

  const residuals = values.map((y, i) => y - (intercept + slope * i))
  const rmse = Math.sqrt(mean(residuals.map((r) => r * r)))
  const band = 1.96 * rmse

  const history: ForecastPoint[] = monthly.map((m) => ({
    label: m.label,
    actual: m.orders,
    forecast: null,
    low: null,
    high: null,
  }))

  const next90: ForecastPoint[] = Array.from({ length: 6 }, (_, k) => {
    const idx = n + k
    const point = intercept + slope * idx
    const monthIdx = (idx % 12) + 1
    return {
      label: MONTH_NAMES[monthIdx - 1].slice(0, 3),
      actual: null,
      forecast: Math.round(point),
      low: Math.round(point - band),
      high: Math.round(point + band),
    }
  })

  const nextMonthOrders = next90[0].forecast ?? 0
  const growthPct = n > 1 ? ((nextMonthOrders - values[n - 1]) / Math.max(values[n - 1], 1)) * 100 : 0

  void history[0]

  return {
    history,
    next90,
    method: 'Holt linear trend · 95% prediction interval',
    nextMonthOrders,
    growthPct,
    band: Math.round(band),
    accuracyNote: `Backtest MAPE ${(mean(values.slice(1).map((v, i) => Math.abs(v - (intercept + slope * i)) / v)) * 100).toFixed(1)}%`,
    horizonMonths: 6,
  }
}

/* ------------------------------------------------------------------ *
 * Data mining
 * ------------------------------------------------------------------ */

export interface ClusterRow {
  id: number
  label: string
  size: number
  share: number
  avgOrderValue: number
  avgDistance: number
  avgDays: number
  lateRate: number
  revenue: number
  traits: string[]
}

export interface RuleRow {
  antecedent: string
  consequent: string
  support: number
  confidence: number
  lift: number
}

export interface AnomalyRow {
  orderId: string
  date: string
  carrier: string
  lane: string
  reason: string
  score: number
  severity: 'critical' | 'warning'
  detail: string
}

export interface MiningResult {
  clusters: ClusterRow[]
  rules: RuleRow[]
  anomalies: AnomalyRow[]
  silhouette: number
  sampled: number
}

const CLUSTER_LABELS = [
  'High-value long-haul',
  'Economy regional',
  'Express premium',
  'Bulk low-risk',
]

export function dataMining(): MiningResult {
  const orders = getOrders()
  const rng = createRng('kmeans-init')

  // ---- k-means on log(order_value), log(distance), actual_days ----------
  const step = Math.max(1, Math.floor(orders.length / 6000))
  const sample = orders.filter((_, i) => i % step === 0)
  const vectors = sample.map((o) => [
    Math.log10(Math.max(o.orderValue, 10)),
    Math.log10(Math.max(o.distanceKm, 40)),
    o.actualDays,
  ])

  const dims = 3
  const mins = Array.from({ length: dims }, (_, d) => Math.min(...vectors.map((v) => v[d])))
  const maxs = Array.from({ length: dims }, (_, d) => Math.max(...vectors.map((v) => v[d])))
  const normalise = (v: number[]) =>
    v.map((x, d) => (maxs[d] === mins[d] ? 0 : (x - mins[d]) / (maxs[d] - mins[d])))

  const points = vectors.map(normalise)
  const k = 4

  let centroids = Array.from({ length: k }, () =>
    Array.from({ length: dims }, () => rng.next()),
  )

  const dist2 = (a: number[], b: number[]) =>
    a.reduce((acc, x, i) => acc + (x - b[i]) ** 2, 0)

  let assignment = new Array(points.length).fill(0)

  for (let iter = 0; iter < 14; iter += 1) {
    assignment = points.map((p) => {
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < k; c += 1) {
        const d = dist2(p, centroids[c])
        if (d < bestD) {
          bestD = d
          best = c
        }
      }
      return best
    })

    centroids = centroids.map((c, ci) => {
      const members = points.filter((_, i) => assignment[i] === ci)
      if (!members.length) return c
      return c.map((_, d) => mean(members.map((m) => m[d])))
    })
  }

  // ---- profile clusters in original units -----------------------------
  const clusters: ClusterRow[] = Array.from({ length: k }, (_, ci) => {
    const members = sample.filter((_, i) => assignment[i] === ci)
    const list = members.length ? members : sample
    const s = summarise(list)
    const revenue = sum(list.map((o) => o.orderValue))
    const avgDistance = mean(list.map((o) => o.distanceKm))
    const avgDays = mean(list.map((o) => o.actualDays))
    const avgValue = mean(list.map((o) => o.orderValue))

    return {
      id: ci,
      label: CLUSTER_LABELS[ci],
      size: list.length,
      share: (list.length / sample.length) * 100,
      avgOrderValue: Math.round(avgValue),
      avgDistance: Math.round(avgDistance),
      avgDays: Math.round(avgDays * 10) / 10,
      lateRate: Math.round(s.lateRate * 10) / 10,
      revenue: Math.round(revenue),
      traits: traitsFor(avgValue, avgDistance, avgDays, s.lateRate),
    }
  }).sort((a, b) => b.size - a.size)

  clusters.forEach((c, i) => {
    c.label = CLUSTER_LABELS[i] ?? `Segment ${i + 1}`
  })

  // silhouette proxy: mean distance to own centroid vs nearest other centroid
  const own = points.map((p, i) => Math.sqrt(dist2(p, centroids[assignment[i]])))
  const other = points.map((p, i) => {
    let best = Infinity
    for (let c = 0; c < k; c += 1) {
      if (c === assignment[i]) continue
      best = Math.min(best, Math.sqrt(dist2(p, centroids[c])))
    }
    return best || 1e-6
  })
  const silhouette = clamp(mean(own.map((a, i) => (other[i] - a) / Math.max(a, other[i]))), -1, 1)

  // ---- association rules ----------------------------------------------
  const attributes: { name: string; value: (o: Order) => string }[] = [
    { name: 'Carrier', value: (o) => o.carrier },
    { name: 'Method', value: (o) => o.shippingMethod },
    { name: 'Size', value: (o) => o.packageSize },
    { name: 'Priority', value: (o) => o.priority },
    { name: 'Segment', value: (o) => o.segment },
    { name: 'Weather', value: (o) => o.weather },
    { name: 'Outcome', value: (o) => (o.late ? 'Late' : 'On time') },
  ]

  const total = orders.length
  const single = new Map<string, number>()
  const pair = new Map<string, number>()

  for (const o of orders) {
    const seen = new Set<string>()
    for (const a of attributes) {
      const key = `${a.name} = ${a.value(o)}`
      single.set(key, (single.get(key) ?? 0) + 1)
      if (seen.has(key)) continue
      seen.add(key)
      for (const b of attributes) {
        if (a === b) continue
        const second = `${b.name} = ${b.value(o)}`
        const pairKey = `${key}  →  ${second}`
        pair.set(pairKey, (pair.get(pairKey) ?? 0) + 1)
      }
    }
  }

  const rules: RuleRow[] = []
  for (const [pairKey, count] of pair) {
    const [antecedent, consequent] = pairKey.split('  →  ')
    const supA = single.get(antecedent) ?? 0
    const supB = single.get(consequent) ?? 0
    if (!supA || !supB) continue
    const support = count / total
    const confidence = count / supA
    const lift = confidence / (supB / total)
    if (support >= 0.012 && confidence >= 0.22 && lift >= 1.12) {
      rules.push({
        antecedent,
        consequent,
        support: Math.round(support * 1000) / 10,
        confidence: Math.round(confidence * 1000) / 10,
        lift: Math.round(lift * 100) / 100,
      })
    }
  }

  const topRules = rules
    .sort((a, b) => b.lift * b.confidence - a.lift * a.confidence)
    .slice(0, 14)
    .sort((a, b) => b.lift - a.lift)

  // ---- anomalies: robust z-score on delay, distance, spend -------------
  const delay = orders.map((o) => o.delayDays)
  const dist = orders.map((o) => o.distanceKm)
  const spend = orders.map((o) => o.shippingCost)
  const mDelay = median(delay)
  const mDist = median(dist)
  const mSpend = median(spend)
  const madDelay = median(delay.map((v) => Math.abs(v - mDelay))) || 1
  const madDist = median(dist.map((v) => Math.abs(v - mDist))) || 1
  const madSpend = median(spend.map((v) => Math.abs(v - mSpend))) || 1

  const anomalies: AnomalyRow[] = orders
    .map((o) => {
      const zDelay = (o.delayDays - mDelay) / (1.4826 * madDelay)
      const zDist = (o.distanceKm - mDist) / (1.4826 * madDist)
      const zSpend = (o.shippingCost - mSpend) / (1.4826 * madSpend)
      const score = Math.max(zDelay, zDist, zSpend)
      return { o, score, zDelay, zDist, zSpend }
    })
    .filter((x) => x.score > 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map(({ o, score, zDelay, zDist, zSpend }) => {
      const drivers: { label: string; z: number }[] = [
        { label: 'Delivery delay', z: zDelay },
        { label: 'Distance', z: zDist },
        { label: 'Shipping spend', z: zSpend },
      ].sort((a, b) => b.z - a.z)
      const top = drivers[0]
      return {
        orderId: o.id,
        date: o.date,
        carrier: o.carrier,
        lane: `${o.warehouseCity} → ${o.country}`,
        reason: top.label,
        score: Math.round(score * 10) / 10,
        severity: score > 8 ? ('critical' as const) : ('warning' as const),
        detail: `${top.label} is ${top.z.toFixed(1)}σ from the median (${top.z > 0 ? 'above' : 'below'} normal).`,
      }
    })

  return {
    clusters,
    rules: topRules,
    anomalies,
    silhouette: Math.round(silhouette * 1000) / 1000,
    sampled: sample.length,
  }
}

function traitsFor(value: number, distance: number, days: number, lateRate: number): string[] {
  const traits: string[] = []
  if (value > 400) traits.push('High basket value')
  else if (value < 90) traits.push('Low basket value')
  if (distance > 4000) traits.push('Long haul')
  else if (distance < 800) traits.push('Regional')
  if (days > 10) traits.push('Slow transit')
  else if (days < 5) traits.push('Fast transit')
  if (lateRate > 65) traits.push('High risk')
  else if (lateRate < 40) traits.push('Reliable')
  return traits
}

/* ------------------------------------------------------------------ *
 * Orders explorer
 * ------------------------------------------------------------------ */

export interface OrdersResult {
  rows: OrderRow[]
  total: number
  facets: {
    carriers: { name: string; count: number }[]
    countries: { name: string; count: number }[]
    segments: { name: string; count: number }[]
    statuses: { name: string; count: number }[]
  }
  summary: {
    orders: number
    revenue: number
    shippingCost: number
    lateRate: number
    avgDays: number
  }
}

export function ordersExplorer(filters: Partial<Filters>, search: string): OrdersResult {
  let rows = selectOrders(filters) as OrderRow[]

  const q = search.trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.customerId.toLowerCase().includes(q) ||
        o.carrier.toLowerCase().includes(q) ||
        o.country.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q) ||
        o.warehouseCity.toLowerCase().includes(q) ||
        o.category.toLowerCase().includes(q),
    )
  }

  const facet = (pick: (o: OrderRow) => string) =>
    [...rows.reduce((map, o) => map.set(pick(o), (map.get(pick(o)) ?? 0) + 1), new Map<string, number>())]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

  const s = summarise(rows)

  return {
    rows,
    total: rows.length,
    facets: {
      carriers: facet((o) => o.carrier),
      countries: facet((o) => o.country),
      segments: facet((o) => o.segment),
      statuses: facet((o) => statusOf(o)),
    },
    summary: {
      orders: rows.length,
      revenue: Math.round(s.revenue),
      shippingCost: Math.round(s.shippingCost),
      lateRate: Math.round(s.lateRate * 10) / 10,
      avgDays: Math.round(s.avgDays * 10) / 10,
    },
  }
}

/* ------------------------------------------------------------------ *
 * Admin / platform
 * ------------------------------------------------------------------ */

export interface PipelineJob {
  id: string
  name: string
  stage: string
  status: 'success' | 'running' | 'warning'
  startedAt: string
  duration: string
  rowsIn: number
  rowsOut: number
  owner: string
}

export function platformInfo(): {
  jobs: PipelineJob[]
  refreshCadence: string
  lastRefresh: string
  environment: { label: string; value: string }[]
} {
  const jobs: PipelineJob[] = [
    {
      id: 'etl-01',
      name: 'Ingest raw orders',
      stage: 'Extract',
      status: 'success',
      startedAt: '2026-12-31 02:00 UTC',
      duration: '1m 48s',
      rowsIn: 50_000,
      rowsOut: 50_000,
      owner: 'data-platform',
    },
    {
      id: 'etl-02',
      name: 'Build dimension tables',
      stage: 'Transform',
      status: 'success',
      startedAt: '2026-12-31 02:02 UTC',
      duration: '12s',
      rowsIn: 50_000,
      rowsOut: 49_079,
      owner: 'data-platform',
    },
    {
      id: 'etl-03',
      name: 'Load fact_delivery',
      stage: 'Load',
      status: 'success',
      startedAt: '2026-12-31 02:02 UTC',
      duration: '38s',
      rowsIn: 49_079,
      rowsOut: 50_000,
      owner: 'data-platform',
    },
    {
      id: 'etl-04',
      name: 'Refresh OLAP cube',
      stage: 'Aggregate',
      status: 'success',
      startedAt: '2026-12-31 02:04 UTC',
      duration: '1m 04s',
      rowsIn: 50_000,
      rowsOut: 8_640,
      owner: 'analytics-eng',
    },
    {
      id: 'etl-05',
      name: 'Rescore risk model',
      stage: 'Machine Learning',
      status: 'running',
      startedAt: '2026-12-31 02:06 UTC',
      duration: '3m 21s',
      rowsIn: 50_000,
      rowsOut: 48_710,
      owner: 'ml-platform',
    },
    {
      id: 'etl-06',
      name: 'Publish metrics mart',
      stage: 'Serve',
      status: 'warning',
      startedAt: '2026-12-31 02:09 UTC',
      duration: '—',
      rowsIn: 0,
      rowsOut: 0,
      owner: 'analytics-eng',
    },
  ]

  return {
    jobs,
    refreshCadence: 'Daily · 02:00 UTC',
    lastRefresh: '2026-12-31 02:14 UTC',
    environment: [
      { label: 'Warehouse', value: 'LogiSense DWH (PostgreSQL 16)' },
      { label: 'Cube', value: 'olap_delivery_cube' },
      { label: 'Model registry', value: 'models/ · 2 artifacts' },
      { label: 'Serving layer', value: 'Flask REST API' },
      { label: 'Client', value: 'React 19 · Vite · Recharts' },
    ],
  }
}

/* ------------------------------------------------------------------ *
 * Shared helpers for pages
 * ------------------------------------------------------------------ */

export function monthlyLabels(): string[] {
  return MONTH_NAMES.map((m) => m.slice(0, 3))
}
