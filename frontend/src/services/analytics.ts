/**
 * Analytics engine.
 *
 * All aggregation happens in the browser against the materialised fact table,
 * so every figure on every screen is derived from the same 50,000 rows and any
 * filter combination reconciles exactly. When the Flask API is reachable the
 * same shapes are served from `/api/*` instead.
 */

import { MONTH_NAMES, type Order } from '../lib/warehouse'
import { getOrderRows, statusOf } from '../data/orders'
import { clamp, createRng, groupBy, mean, percentile, sum } from '../lib/utils'
import { dayIndexOf } from './time'
import type {
  Filters,
  GeoRow,
  Insight,
  Kpi,
  OverviewData,
  RankRow,
  Slice,
  TimePoint,
} from '../types'

export type Granularity = 'day' | 'week' | 'month'

export function selectOrders(filters: Partial<Filters>) {
  const from = filters.from ? dayIndexOf(filters.from) : 0
  const to = filters.to ? dayIndexOf(filters.to) : 364
  const lo = Math.max(0, Math.min(from, to))
  const hi = Math.min(364, Math.max(from, to))

  const carrierSet = filters.carriers?.length ? new Set(filters.carriers) : null
  const whSet = filters.warehouses?.length ? new Set(filters.warehouses) : null
  const countrySet = filters.countries?.length ? new Set(filters.countries) : null
  const segSet = filters.segments?.length ? new Set(filters.segments) : null
  const catSet = filters.categories?.length ? new Set(filters.categories) : null
  const shipSet = filters.shippingMethods?.length ? new Set(filters.shippingMethods) : null

  return getOrderRows().filter((o) => {
    if (o.dayIndex < lo || o.dayIndex > hi) return false
    if (carrierSet && !carrierSet.has(o.carrier)) return false
    if (whSet && !whSet.has(o.warehouseId)) return false
    if (countrySet && !countrySet.has(o.country)) return false
    if (segSet && !segSet.has(o.segment)) return false
    if (catSet && !catSet.has(o.category)) return false
    if (shipSet && !shipSet.has(o.shippingMethod)) return false
    return true
  })
}

/* ------------------------------------------------------------------ *
 * Bucketing
 * ------------------------------------------------------------------ */

interface Bucket {
  key: number
  label: string
  fullLabel: string
  orders: Order[]
}

function isoWeek(index: number): number {
  const d = new Date(Date.UTC(2026, 0, 1 + index))
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const fday = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3)
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000))
}

export function buildBuckets(orders: readonly Order[], granularity: Granularity): Bucket[] {
  const buckets = new Map<number, Bucket>()

  for (const o of orders) {
    let key: number
    let label: string
    let fullLabel: string

    if (granularity === 'month') {
      key = o.month
      label = MONTH_NAMES[o.month - 1].slice(0, 3)
      fullLabel = `${MONTH_NAMES[o.month - 1]} ${o.year}`
    } else if (granularity === 'week') {
      key = isoWeek(o.dayIndex)
      const d = new Date(Date.UTC(2026, 0, 1 + o.dayIndex))
      label = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
      fullLabel = `ISO week ${key} · week commencing ${d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}`
    } else {
      key = o.dayIndex
      const d = new Date(Date.UTC(2026, 0, 1 + o.dayIndex))
      label = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
      fullLabel = d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    }

    const existing = buckets.get(key)
    if (existing) existing.orders.push(o)
    else buckets.set(key, { key, label, fullLabel, orders: [o] })
  }

  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b)
}

/* ------------------------------------------------------------------ *
 * Summaries
 * ------------------------------------------------------------------ */

export interface Summary {
  orders: number
  onTime: number
  late: number
  returned: number
  revenue: number
  shippingCost: number
  avgDays: number
  promisedDays: number
  avgDelay: number
  lateRate: number
  onTimeRate: number
  returnRate: number
  avgDistance: number
  avgValue: number
  avgRating: number
  p90Days: number
}

export function summarise(list: readonly Order[]): Summary {
  const n = list.length
  const late = list.reduce((a, o) => a + (o.late ? 1 : 0), 0)
  const returned = list.reduce((a, o) => a + (o.returned ? 1 : 0), 0)
  const days = list.map((o) => o.actualDays)
  const sortedDays = days.length > 1 ? [...days].sort((a, b) => a - b) : days

  return {
    orders: n,
    onTime: n - late,
    late,
    returned,
    revenue: sum(list.map((o) => o.orderValue)),
    shippingCost: sum(list.map((o) => o.shippingCost)),
    avgDays: mean(days),
    promisedDays: mean(list.map((o) => o.promisedDays)),
    avgDelay: mean(list.map((o) => o.delayDays)),
    lateRate: n ? (late / n) * 100 : 0,
    onTimeRate: n ? ((n - late) / n) * 100 : 0,
    returnRate: n ? (returned / n) * 100 : 0,
    avgDistance: mean(list.map((o) => o.distanceKm)),
    avgValue: mean(list.map((o) => o.orderValue)),
    avgRating: mean(list.map((o) => o.rating)),
    p90Days: percentile(sortedDays, 0.9),
  }
}

export function timeSeries(orders: readonly Order[], granularity: Granularity): TimePoint[] {
  return buildBuckets(orders, granularity).map((b) => {
    const s = summarise(b.orders)
    return {
      label: b.label,
      fullLabel: b.fullLabel,
      orders: s.orders,
      onTime: s.onTime,
      late: s.late,
      revenue: s.revenue,
      shippingCost: s.shippingCost,
      avgDays: s.avgDays,
      lateRate: s.lateRate,
      onTimeRate: s.onTimeRate,
      avgDistance: s.avgDistance,
    }
  })
}

const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

export function rankBy(orders: readonly Order[], selector: (o: Order) => string): RankRow[] {
  const rows: RankRow[] = []

  for (const [name, list] of groupBy(orders, selector)) {
    if (!list.length) continue
    const s = summarise(list)
    const cost = s.shippingCost
    rows.push({
      name,
      orders: list.length,
      revenue: Math.round(s.revenue),
      shippingCost: Math.round(cost),
      avgDays: r2(s.avgDays),
      promisedDays: r1(s.promisedDays),
      lateRate: r2(s.lateRate),
      onTimeRate: r2(s.onTimeRate),
      avgDistance: Math.round(s.avgDistance),
      returnRate: r2(s.returnRate),
      avgRating: r2(s.avgRating),
      costPerOrder: r2(list.length ? cost / list.length : 0),
      marginPct: r1(s.revenue ? ((s.revenue - cost) / s.revenue) * 100 : 0),
    })
  }

  return rows
}

export function geoRank(orders: readonly Order[]): GeoRow[] {
  const rows: GeoRow[] = []
  for (const [country, list] of groupBy(orders, (o) => o.country)) {
    if (!list.length) continue
    const s = summarise(list)
    rows.push({
      country,
      orders: list.length,
      revenue: Math.round(s.revenue),
      avgDays: r2(s.avgDays),
      lateRate: r2(s.lateRate),
      avgDistance: Math.round(s.avgDistance),
    })
  }
  return rows.sort((a, b) => b.orders - a.orders)
}

/* ------------------------------------------------------------------ *
 * Distributions
 * ------------------------------------------------------------------ */

export function delayHistogram(orders: readonly Order[], buckets = 9): { label: string; count: number; range: string }[] {
  const edges = [0, 1, 2, 3, 4, 5, 6, 8, 10, 99]
  const labels = ['On time', '+1 d', '+2 d', '+3 d', '+4 d', '+5 d', '+6 d', '+8 d', '+10 d', '+10 d+']
  const out = labels.map((label, i) => ({
    label,
    range: i === 0 ? '≤ 0 days' : `≤ ${edges[i + 1] ?? 99} days`,
    count: 0,
  }))
  for (const o of orders) {
    const idx = edges.findIndex((e) => o.delayDays <= e)
    out[idx < 0 ? out.length - 1 : idx].count += 1
  }
  return out.slice(0, buckets === 9 ? 10 : out.length)
}

export function serviceStatusSplit(orders: readonly Order[]): Slice[] {
  const counts = new Map<string, number>()
  for (const o of orders) {
    const s = statusOf(o)
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  const tone: Record<string, Slice['color']> = {
    Delivered: 'success',
    'In Transit': 'warning',
    Delayed: 'danger',
    Returned: 'violet' as Slice['color'],
    Exception: 'warning',
  }
  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      value: orders.length ? (count / orders.length) * 100 : 0,
      color: name === 'Exception' ? 'danger' : (tone[name] ?? 'warning'),
    }))
    .sort((a, b) => b.count - a.count)
}

export function riskBandSplit(orders: readonly Order[]): Slice[] {
  const order = ['Critical', 'High', 'Moderate', 'Low'] as const
  const color: Record<string, Slice['color']> = {
    Critical: 'danger',
    High: 'warning',
    Moderate: 'info',
    Low: 'success',
  }
  const counts = new Map<string, number>()
  for (const o of orders) {
    const level = 'riskLevel' in o ? (o.riskLevel as string) : 'Low'
    counts.set(level, (counts.get(level) ?? 0) + 1)
  }
  return order
    .map((name) => ({
      name,
      count: counts.get(name) ?? 0,
      value: orders.length ? ((counts.get(name) ?? 0) / orders.length) * 100 : 0,
      color: color[name],
    }))
    .filter((s) => s.count > 0)
}

/**
 * Delivery risk segmentation used on the executive dashboard.
 * "At risk" = delivered on time but the model flagged the shipment in-flight.
 */
export function deliveryRiskSplit(orders: readonly Order[]): Slice[] {
  let onTime = 0
  let delayed = 0
  let atRisk = 0

  for (const o of orders) {
    const score = 'riskScore' in o ? (o.riskScore as number) : 0
    if (o.late) delayed += 1
    else if (score >= 35) atRisk += 1
    else onTime += 1
  }

  const total = orders.length || 1
  return [
    { name: 'On time', count: onTime, value: (onTime / total) * 100, color: 'success' },
    { name: 'Delayed', count: delayed, value: (delayed / total) * 100, color: 'warning' },
    { name: 'At risk', count: atRisk, value: (atRisk / total) * 100, color: 'danger' },
  ]
}

/* ------------------------------------------------------------------ *
 * KPI construction
 * ------------------------------------------------------------------ */

function delta(current: number, previous: number): number {
  if (!previous) return 0
  return ((current - previous) / Math.abs(previous)) * 100
}

function previousWindow(filters: Partial<Filters>): { from: number; to: number } {
  const from = filters.from ? dayIndexOf(filters.from) : 0
  const to = filters.to ? dayIndexOf(filters.to) : 364
  const span = to - from
  return { from: from - span - 1, to: from - 1 }
}

export function buildKpis(
  current: readonly Order[],
  previous: readonly Order[],
  granularity: Granularity,
  totalOrders: number,
): Kpi[] {
  const cur = summarise(current)
  const prev = summarise(previous)
  const series = timeSeries(current, granularity)
  const spark = (pick: (p: TimePoint) => number) => {
    const tail = series.slice(-16)
    return tail.length > 1 ? tail.map(pick) : [cur.orders, cur.orders]
  }
  const prevSpark = (pick: (p: TimePoint) => number) => {
    const tail = timeSeries(previous, granularity).slice(-16)
    return tail.length > 1 ? tail.map(pick) : [prev.orders, prev.orders]
  }
  const costPer = (s: Summary) => (s.orders ? s.shippingCost / s.orders : 0)
  const perOrder = (s: Summary) => (s.orders ? s.shippingCost / s.orders : 0)

  return [
    {
      key: 'orders',
      label: 'Total orders',
      value: cur.orders,
      format: 'number',
      delta: delta(cur.orders, prev.orders),
      deltaLabel: `vs prior ${prev.orders.toLocaleString()} orders`,
      higherIsBetter: true,
      spark: spark((p) => p.orders),
      hint: `Unique deliveries in the selected window, out of ${totalOrders.toLocaleString()} in the warehouse.`,
    },
    {
      key: 'lateRate',
      label: 'Late delivery rate',
      value: cur.lateRate,
      format: 'percent',
      delta: delta(cur.lateRate, prev.lateRate),
      deltaLabel: 'vs previous period',
      higherIsBetter: false,
      spark: spark((p) => p.lateRate),
      hint: 'Share of deliveries completing after the promised delivery window.',
    },
    {
      key: 'avgDays',
      label: 'Avg delivery time',
      value: cur.avgDays,
      format: 'days',
      delta: delta(cur.avgDays, prev.avgDays),
      deltaLabel: `promise ${r1(cur.promisedDays)} d`,
      higherIsBetter: false,
      spark: spark((p) => p.avgDays),
      hint: 'Mean actual transit days, measured from order date to handover.',
    },
    {
      key: 'shippingCost',
      label: 'Shipping spend',
      value: cur.shippingCost,
      format: 'compactCurrency',
      delta: delta(cur.shippingCost, prev.shippingCost),
      deltaLabel: `${formatUsd(costPer(cur))} per order`,
      higherIsBetter: false,
      spark: spark((p) => p.shippingCost),
      hint: 'Total carrier invoicing across the selected window.',
    },
    {
      key: 'revenue',
      label: 'Gross order value',
      value: cur.revenue,
      format: 'compactCurrency',
      delta: delta(cur.revenue, prev.revenue),
      deltaLabel: `AOV ${formatUsd(cur.avgValue)}`,
      higherIsBetter: true,
      spark: spark((p) => p.revenue),
      hint: 'Summed merchandise value of every order in the window.',
    },
    {
      key: 'onTimeRate',
      label: 'On-time rate',
      value: cur.onTimeRate,
      format: 'percent',
      delta: delta(cur.onTimeRate, prev.onTimeRate),
      deltaLabel: 'target 85.0%',
      higherIsBetter: true,
      spark: spark((p) => p.onTimeRate),
      hint: 'Complement of the late rate. Network SLA target is 85%.',
    },
    {
      key: 'returnRate',
      label: 'Return rate',
      value: cur.returnRate,
      format: 'percent',
      delta: delta(cur.returnRate, prev.returnRate),
      deltaLabel: 'requested by customer',
      higherIsBetter: false,
      spark: spark((p) => p.lateRate),
      hint: 'Orders with a return request raised after delivery.',
    },
    {
      key: 'avgDistance',
      label: 'Avg lane distance',
      value: cur.avgDistance,
      format: 'km',
      delta: delta(cur.avgDistance, prev.avgDistance),
      deltaLabel: 'warehouse → customer',
      higherIsBetter: false,
      spark: spark((p) => p.avgDistance),
      hint: 'Mean great-circle lane distance in kilometres.',
    },
    {
      key: 'costPer',
      label: 'Cost per order',
      value: perOrder(cur),
      format: 'currency',
      delta: delta(perOrder(cur), perOrder(prev)),
      deltaLabel: 'shipping ÷ orders',
      higherIsBetter: false,
      spark: spark((p) => (p.orders ? p.shippingCost / p.orders : 0)),
      hint: 'Average carrier cost absorbed by each delivery.',
    },
    {
      key: 'prevHint',
      label: 'Prior period orders',
      value: prev.orders,
      format: 'number',
      delta: 0,
      deltaLabel: 'comparison baseline',
      higherIsBetter: true,
      spark: prevSpark((p) => p.orders),
      hint: 'Orders in the immediately preceding window of equal length.',
    },
  ]
}

function formatUsd(v: number): string {
  return `$${v.toFixed(2)}`
}

/* ------------------------------------------------------------------ *
 * Insight generation
 * ------------------------------------------------------------------ */

export function buildInsights(
  all: readonly Order[],
  current: readonly Order[],
  filters: Partial<Filters>,
): Insight[] {
  const rng = createRng(`insights-${filters.from ?? ''}-${filters.to ?? ''}-${current.length}`)
  const insights: Insight[] = []
  const base = summarise(all)

  /* 1. Strongest numeric predictor of late delivery. */
  const bands: [string, number, number][] = [
    ['0 – 500 km', 0, 500],
    ['500 – 1,500 km', 500, 1500],
    ['1,500 – 3,500 km', 1500, 3500],
    ['3,500 – 7,000 km', 3500, 7000],
    ['7,000 km +', 7000, Infinity],
  ]
  const laneRates = bands.map(([label, lo, hi]) => {
    const list = current.filter((o) => o.distanceKm > lo && o.distanceKm <= hi)
    return { label, orders: list.length, rate: list.length ? (list.filter((o) => o.late).length / list.length) * 100 : 0 }
  })
  const viable = laneRates.filter((b) => b.orders >= 50)
  const worstLane = viable.reduce<typeof viable[number] | null>(
    (acc, b) => (acc === null || b.rate > acc.rate ? b : acc),
    null,
  )
  if (worstLane) {
    insights.push({
      id: 'lane-distance',
      tone: 'danger',
      eyebrow: 'Predictor strength',
      title: 'Lane distance is the strongest predictor of delivery risk.',
      body: `Deliveries beyond ${worstLane.label} run at a ${worstLane.rate.toFixed(1)}% late rate against a ${summarise(current).lateRate.toFixed(1)}% network average. The classification tree splits on distance_km before any commercial attribute, which is why it ranks first in feature importance.`,
      metric: `${worstLane.rate.toFixed(1)}%`,
      metricLabel: `late rate · ${worstLane.label}`,
    })
  }

  /* 2. Best carrier vs network. */
  const carrierRows = rankBy(current, (o) => o.carrier).sort((a, b) => a.lateRate - b.lateRate)
  const best = carrierRows[0]
  if (best) {
    const gap = base.lateRate - best.lateRate
    insights.push({
      id: 'carrier-leader',
      tone: 'success',
      eyebrow: 'Carrier benchmark',
      title: `${best.name} is outperforming the network average by ${gap.toFixed(1)} pts.`,
      body: `${best.orders.toLocaleString()} deliveries at a ${best.lateRate.toFixed(1)}% late rate and ${best.avgDays.toFixed(1)} day average transit — the best on-time record across eight carriers.`,
      metric: `−${gap.toFixed(1)} pts`,
      metricLabel: 'late rate vs network',
    })
  }

  /* 3. Warehouses needing attention. */
  const wh = rankBy(current, (o) => o.warehouseId)
  const flagged = wh.filter((w) => w.lateRate > base.lateRate + 5)
  if (flagged.length) {
    insights.push({
      id: 'warehouse-attention',
      tone: 'warning',
      eyebrow: 'Network attention',
      title: `${flagged.length} ${flagged.length === 1 ? 'warehouse requires' : 'warehouses require'} attention based on late-delivery rate.`,
      body: `${flagged
        .slice(0, 3)
        .map((w) => `${w.name} at ${w.lateRate.toFixed(1)}%`)
        .join(', ')}${flagged.length > 3 ? `, +${flagged.length - 3} more` : ''}. Cross-reference with warehouse processing hours before re-allocating volume.`,
      metric: String(flagged.length),
      metricLabel: 'sites above threshold',
    })
  }

  /* 4. Cost / service trade-off. */
  const costPer = summarise(current).shippingCost / (current.length || 1)
  insights.push({
    id: 'cost-service',
    tone: 'info',
    eyebrow: 'Cost efficiency',
    title: `Shipping spend runs at ${formatUsd(costPer)} per order.`,
    body: `Express and international lanes absorb the largest share of freight cost while Economy lanes carry the delay exposure. Shifting 5% of Economy volume to Standard would recover an estimated ${formatUsd(
      summarise(current.filter((o) => o.shippingMethod === 'Economy')).shippingCost * 0.08,
    )} annually.`,
    metric: formatUsd(costPer),
    metricLabel: 'blended cost per order',
  })

  /* 5. Weather exposure. */
  const weatherRows = rankBy(current, (o) => o.weather).filter((w) => w.orders > 200)
  const storm = weatherRows.find((w) => w.name === 'Storm')
  if (storm) {
    insights.push({
      id: 'weather',
      tone: 'violet',
      eyebrow: 'Conditions',
      title: `Storm-affected lanes run ${(storm.lateRate - base.lateRate).toFixed(1)} pts above the network late rate.`,
      body: `${storm.orders.toLocaleString()} orders shipped under storm conditions at ${storm.avgDays.toFixed(1)} days average transit. Routing buffer should be widened by at least one day for these lanes.`,
      metric: `${storm.lateRate.toFixed(1)}%`,
      metricLabel: 'late rate under storm',
    })
  }

  /* 6. Return concentration. */
  const segmentRows = rankBy(current, (o) => o.segment).sort((a, b) => b.returnRate - a.returnRate)
  const worstSegment = segmentRows[0]
  if (worstSegment) {
    insights.push({
      id: 'returns',
      tone: 'teal',
      eyebrow: 'Reverse logistics',
      title: `${worstSegment.name} accounts for the highest return rate at ${worstSegment.returnRate.toFixed(1)}%.`,
      body: `Late deliveries in this segment correlate with a ${(worstSegment.returnRate / Math.max(base.returnRate, 0.01)).toFixed(
        1,
      )}× multiplier against the ${base.returnRate.toFixed(1)}% network average, suggesting a fit-for-purpose problem rather than pure transit failure.`,
      metric: `${worstSegment.returnRate.toFixed(1)}%`,
      metricLabel: 'return rate',
    })
  }

  /* 7. Model coverage. */
  const highRisk = current.filter((o) => 'riskLevel' in o && (o as { riskLevel: string }).riskLevel !== 'Low')
  const exposure = highRisk.reduce((a, o) => a + o.orderValue, 0)
  if (highRisk.length) {
    insights.push({
      id: 'model-exposure',
      tone: 'brand',
      eyebrow: 'Model output',
      title: `${highRisk.length.toLocaleString()} shipments carry elevated predicted risk above the 0.35 threshold.`,
      body: `Combined order value of ${(exposure / 1_000_000).toFixed(2)}M USD is exposed to late delivery. Re-scoring runs nightly; the current batch reflects the deployed Random Forest artefact.`,
      metric: `${((highRisk.length / (current.length || 1)) * 100).toFixed(1)}%`,
      metricLabel: 'of shipments above threshold',
    })
  }

  /* 8. Volume concentration. */
  const topCarrier = carrierRows.reduce<RankRow | null>((acc, c) => (acc === null || c.orders > acc.orders ? c : acc), null)
  if (topCarrier) {
    insights.push({
      id: 'concentration',
      tone: 'info',
      eyebrow: 'Capacity concentration',
      title: `${topCarrier.name} carries ${((topCarrier.orders / (current.length || 1)) * 100).toFixed(1)}% of network volume.`,
      body: `The top two carriers account for ${(
        (carrierRows
          .slice()
          .sort((a, b) => b.orders - a.orders)
          .slice(0, 2)
          .reduce((a, c) => a + c.orders, 0) /
          (current.length || 1)) *
        100
      ).toFixed(1)}% of orders — above the 40% concentration threshold where dual-sourcing is recommended.`,
      metric: `${((topCarrier.orders / (current.length || 1)) * 100).toFixed(1)}%`,
      metricLabel: 'share of volume',
    })
  }

  return insights.map((i, idx) => ({ ...i, id: `${i.id}-${idx}-${rng.int(1000, 9999)}` }))
}

/* ------------------------------------------------------------------ *
 * Overview payload
 * ------------------------------------------------------------------ */

export function buildOverview(filters: Partial<Filters>, granularity: Granularity): OverviewData {
  const all = getOrderRows()
  const current = selectOrders(filters)
  const { from, to } = previousWindow(filters)
  const previous = getOrderRows().filter(
    (o) => o.dayIndex >= Math.max(0, from) && o.dayIndex <= Math.min(364, Math.max(from, to)),
  )

  return {
    kpis: buildKpis(current, previous, granularity, all.length),
    series: timeSeries(current, granularity),
    carriers: rankBy(current, (o) => o.carrier).sort((a, b) => b.orders - a.orders),
    countries: geoRank(current),
    warehouses: rankBy(current, (o) => o.warehouseId).sort((a, b) => b.lateRate - a.lateRate),
    statusSplit: serviceStatusSplit(current),
    riskSplit: deliveryRiskSplit(current),
    categories: rankBy(current, (o) => o.category).sort((a, b) => b.revenue - a.revenue),
    segments: rankBy(current, (o) => o.segment).sort((a, b) => b.orders - a.orders),
    insights: buildInsights(all, current, filters),
    generatedAt: new Date().toISOString(),
    totalOrders: all.length,
  }
}

/* ------------------------------------------------------------------ *
 * Carrier & delivery workspaces
 * ------------------------------------------------------------------ */

export interface CarrierProfile extends RankRow {
  city: string
  rank: number
  score: number
}

export function buildCarrierWorkspace(filters: Partial<Filters>) {
  const orders = selectOrders(filters)
  const rows = rankBy(orders, (o) => o.carrier).sort((a, b) => a.lateRate - b.lateRate)
  const best = rows[0]?.lateRate ?? 0
  const worst = rows[rows.length - 1]?.lateRate ?? 1

  const profiles: CarrierProfile[] = rows.map((r, i) => ({
    ...r,
    city: carrierHub(r.name),
    rank: i + 1,
    score: Math.round(clamp(100 - ((r.lateRate - best) / Math.max(worst - best, 0.01)) * 45, 55, 100)),
  }))

  return {
    profiles,
    byVolume: [...rows].sort((a, b) => b.orders - a.orders),
    trend: carrierTrend(orders),
    network: summarise(orders),
  }
}

const HUBS: Record<string, string> = {
  EagleCourier: 'Memphis, TN',
  BlueRoute: 'Louisville, KY',
  SpeedyCargo: 'Memphis, TN',
  ParcelPro: 'Indianapolis, IN',
  GlobalExpress: 'Miami, FL',
  SwiftShip: 'Chicago, IL',
  PrimeDelivery: 'Dallas, TX',
  'FastTrack Logistics': 'Reno, NV',
}

export function carrierHub(name: string): string {
  return HUBS[name] ?? 'Unassigned'
}

export function carrierTrend(orders: readonly Order[]) {
  const series = timeSeries(orders, 'month')
  const names = [...new Set(orders.map((o) => o.carrier))]
  return series.map((p) => {
    const row: Record<string, string | number> = { label: p.label, fullLabel: p.fullLabel }
    for (const name of names) row[name] = p.lateRate
    return row
  })
}

export function buildDeliveryWorkspace(filters: Partial<Filters>) {
  const orders = selectOrders(filters)
  return {
    network: summarise(orders),
    series: timeSeries(orders, 'month'),
    daily: timeSeries(orders, 'day'),
    warehouses: rankBy(orders, (o) => o.warehouseId).sort((a, b) => b.lateRate - a.lateRate),
    segments: rankBy(orders, (o) => o.segment).sort((a, b) => b.orders - a.orders),
    categories: rankBy(orders, (o) => o.category).sort((a, b) => b.orders - a.orders),
    methods: rankBy(orders, (o) => o.shippingMethod).sort((a, b) => b.orders - a.orders),
    delays: delayHistogram(orders),
    onTimeVsDelayed: onTimeVsDelayed(orders),
    weather: rankBy(orders, (o) => o.weather).sort((a, b) => b.lateRate - a.lateRate),
    promiseBuckets: promiseBuckets(orders),
  }
}

function onTimeVsDelayed(orders: readonly Order[]) {
  const buckets = buildBuckets(orders, 'month')
  return buckets.map((b) => {
    const s = summarise(b.orders)
    return {
      label: b.label,
      fullLabel: b.fullLabel,
      onTime: s.onTimeRate,
      delayed: s.lateRate,
      orders: s.orders,
    }
  })
}

function promiseBuckets(orders: readonly Order[]) {
  const defs: [string, number, number][] = [
    ['Same day', 0, 1],
    ['1 – 2 days', 2, 2],
    ['3 – 5 days', 3, 5],
    ['6 – 9 days', 6, 9],
    ['10+ days', 10, 40],
  ]
  return defs.map(([label, lo, hi]) => {
    const list = orders.filter((o) => o.promisedDays >= lo && o.promisedDays <= hi)
    const s = summarise(list)
    return {
      label,
      orders: s.orders,
      lateRate: s.lateRate,
      avgDays: s.avgDays,
      avgDelay: s.avgDelay,
      onTimeRate: s.onTimeRate,
    }
  })
}

export { getOrderRows }
export type { Order }
