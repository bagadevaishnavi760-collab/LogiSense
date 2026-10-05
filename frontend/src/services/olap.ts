import {
  CARRIERS,
  MONTH_NAMES,
  PACKAGE_SIZES,
  PAYMENT_METHODS,
  SEGMENTS,
  SHIPPING_METHODS,
  WEATHER,
  WAREHOUSES,
  type Order,
} from '../lib/warehouse'
import { mean, sum } from '../lib/utils'
import { selectOrders } from './analytics'
import type { Filters } from '../types'

/* ------------------------------------------------------------------ *
 * Dimensions & hierarchies
 * ------------------------------------------------------------------ */

export interface DimensionLevel {
  key: string
  label: string
  short: string
  access: (o: Order) => string
}

export interface Dimension {
  key: string
  label: string
  group: 'Time' | 'Network' | 'Customer' | 'Product' | 'Service'
  /** Coarsest → finest */
  levels: DimensionLevel[]
}

export const DIMENSIONS: Dimension[] = [
  {
    key: 'date',
    label: 'Order Date',
    group: 'Time',
    levels: [
      { key: 'year', label: 'Year', short: 'Year', access: (o) => String(o.year) },
      { key: 'quarter', label: 'Quarter', short: 'Qtr', access: (o) => o.quarter },
      { key: 'month', label: 'Month', short: 'Month', access: (o) => MONTH_NAMES[o.month - 1] },
      {
        key: 'week',
        label: 'Week',
        short: 'Week',
        access: (o) => `W${weekOf(o.dayIndex)}`,
      },
      {
        key: 'day',
        label: 'Day',
        short: 'Day',
        access: (o) => {
          const d = new Date(Date.UTC(2026, 0, 1 + o.dayIndex))
          return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`
        },
      },
      {
        key: 'dow',
        label: 'Day of Week',
        short: 'DoW',
        access: (o) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][o.dayOfWeek],
      },
    ],
  },
  {
    key: 'carrier',
    label: 'Carrier',
    group: 'Network',
    levels: [
      { key: 'carrier', label: 'Carrier', short: 'Carrier', access: (o) => o.carrier },
    ],
  },
  {
    key: 'warehouse',
    label: 'Warehouse',
    group: 'Network',
    levels: [
      { key: 'warehouse', label: 'Warehouse', short: 'WH', access: (o) => o.warehouseId },
      { key: 'warehouseCity', label: 'Warehouse City', short: 'City', access: (o) => o.warehouseCity },
    ],
  },
  {
    key: 'destination',
    label: 'Destination',
    group: 'Network',
    levels: [
      { key: 'country', label: 'Country', short: 'Country', access: (o) => o.country },
      { key: 'city', label: 'City', short: 'City', access: (o) => o.city },
    ],
  },
  {
    key: 'segment',
    label: 'Customer Segment',
    group: 'Customer',
    levels: [
      { key: 'segment', label: 'Segment', short: 'Segment', access: (o) => o.segment },
    ],
  },
  {
    key: 'product',
    label: 'Product',
    group: 'Product',
    levels: [
      { key: 'category', label: 'Product Category', short: 'Category', access: (o) => o.category },
      { key: 'packageSize', label: 'Package Size', short: 'Size', access: (o) => o.packageSize },
    ],
  },
  {
    key: 'service',
    label: 'Service Level',
    group: 'Service',
    levels: [
      { key: 'shippingMethod', label: 'Shipping Method', short: 'Method', access: (o) => o.shippingMethod },
      { key: 'priority', label: 'Order Priority', short: 'Priority', access: (o) => o.priority },
    ],
  },
  {
    key: 'conditions',
    label: 'Conditions',
    group: 'Service',
    levels: [
      { key: 'weather', label: 'Weather', short: 'Weather', access: (o) => o.weather },
      {
        key: 'weekend',
        label: 'Weekend',
        short: 'Wknd',
        access: (o) => (o.isWeekend ? 'Weekend' : 'Weekday'),
      },
    ],
  },
]

function weekOf(dayIndex: number): number {
  const d = new Date(Date.UTC(2026, 0, 1 + dayIndex))
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day)
  return Math.round((d.getTime() - Date.UTC(2025, 11, 29)) / (7 * 86400000)) + 1
}

export function getDimension(key: string): Dimension | undefined {
  return DIMENSIONS.find((d) => d.key === key)
}

export function getLevel(dimensionKey: string, levelKey: string): DimensionLevel | undefined {
  return getDimension(dimensionKey)?.levels.find((l) => l.key === levelKey)
}

/* ------------------------------------------------------------------ *
 * Measures
 * ------------------------------------------------------------------ */

export type MeasureFormat =
  | 'number'
  | 'compact'
  | 'currency'
  | 'compactCurrency'
  | 'percent'
  | 'days'
  | 'km'
  | 'kg'
  | 'rating'

export interface Measure {
  key: string
  label: string
  format: MeasureFormat
  description: string
  better: 'lower' | 'higher' | 'none'
  compute: (orders: readonly Order[]) => number
}

export const MEASURES: Measure[] = [
  {
    key: 'orders',
    label: 'Order Count',
    format: 'compact',
    description: 'Distinct deliveries in the current cell',
    better: 'higher',
    compute: (o) => o.length,
  },
  {
    key: 'revenue',
    label: 'Order Value',
    format: 'compactCurrency',
    description: 'SUM(order_value_usd)',
    better: 'higher',
    compute: (o) => sum(o.map((x) => x.orderValue)),
  },
  {
    key: 'shippingCost',
    label: 'Shipping Cost',
    format: 'compactCurrency',
    description: 'SUM(shipping_cost_usd)',
    better: 'lower',
    compute: (o) => sum(o.map((x) => x.shippingCost)),
  },
  {
    key: 'margin',
    label: 'Net Margin',
    format: 'compactCurrency',
    description: 'SUM(order_value_usd) − SUM(shipping_cost_usd)',
    better: 'higher',
    compute: (o) => sum(o.map((x) => x.orderValue - x.shippingCost)),
  },
  {
    key: 'avgDeliveryDays',
    label: 'Avg Delivery Days',
    format: 'days',
    description: 'AVG(actual_delivery_days)',
    better: 'lower',
    compute: (o) => mean(o.map((x) => x.actualDays)),
  },
  {
    key: 'avgPromisedDays',
    label: 'Avg Promised Days',
    format: 'days',
    description: 'AVG(promised_delivery_days)',
    better: 'lower',
    compute: (o) => mean(o.map((x) => x.promisedDays)),
  },
  {
    key: 'avgDelayDays',
    label: 'Avg Delay Days',
    format: 'days',
    description: 'AVG(delivery_delay_days)',
    better: 'lower',
    compute: (o) => mean(o.map((x) => x.delayDays)),
  },
  {
    key: 'lateRate',
    label: 'Late Delivery Rate',
    format: 'percent',
    description: 'Share of deliveries flagged late',
    better: 'lower',
    compute: (o) => (o.length ? (o.filter((x) => x.late).length / o.length) * 100 : 0),
  },
  {
    key: 'onTimeRate',
    label: 'On-Time Rate',
    format: 'percent',
    description: 'Share of deliveries within promise',
    better: 'higher',
    compute: (o) => (o.length ? (o.filter((x) => !x.late).length / o.length) * 100 : 0),
  },
  {
    key: 'returnRate',
    label: 'Return Rate',
    format: 'percent',
    description: 'Share of orders with a return request',
    better: 'lower',
    compute: (o) => (o.length ? (o.filter((x) => x.returned).length / o.length) * 100 : 0),
  },
  {
    key: 'avgDistance',
    label: 'Avg Distance',
    format: 'km',
    description: 'AVG(distance_km)',
    better: 'lower',
    compute: (o) => mean(o.map((x) => x.distanceKm)),
  },
  {
    key: 'avgOrderValue',
    label: 'Avg Order Value',
    format: 'currency',
    description: 'AVG(order_value_usd)',
    better: 'higher',
    compute: (o) => mean(o.map((x) => x.orderValue)),
  },
  {
    key: 'avgWeight',
    label: 'Avg Weight',
    format: 'kg',
    description: 'AVG(product_weight_kg)',
    better: 'none',
    compute: (o) => mean(o.map((x) => x.weightKg)),
  },
  {
    key: 'avgRating',
    label: 'Avg Rating',
    format: 'rating',
    description: 'AVG(customer_rating)',
    better: 'higher',
    compute: (o) => mean(o.map((x) => x.rating)),
  },
  {
    key: 'avgAttempts',
    label: 'Avg Attempts',
    format: 'number',
    description: 'AVG(delivery_attempts)',
    better: 'lower',
    compute: (o) => mean(o.map((x) => x.attempts)),
  },
  {
    key: 'costPerOrder',
    label: 'Cost per Order',
    format: 'currency',
    description: 'Shipping spend ÷ order count',
    better: 'lower',
    compute: (o) => (o.length ? sum(o.map((x) => x.shippingCost)) / o.length : 0),
  },
]

export function getMeasure(key: string): Measure {
  return MEASURES.find((m) => m.key === key) ?? MEASURES[0]
}

/* ------------------------------------------------------------------ *
 * Operations
 * ------------------------------------------------------------------ */

export type OlapOperation = 'pivot' | 'slice' | 'dice' | 'rollup' | 'drilldown'

export const OPERATIONS: {
  key: OlapOperation
  label: string
  blurb: string
  detail: string
}[] = [
  {
    key: 'pivot',
    label: 'Pivot',
    blurb: 'Cross-tab rows against columns',
    detail:
      'Rotates the cube so one dimension becomes column headers and another becomes row headers, with the measure at each intersection.',
  },
  {
    key: 'slice',
    label: 'Slice',
    blurb: 'Single member filter',
    detail:
      'Fixes one dimension to a single member — for example “International” shipping only — and reports the measure across the remaining dimensions.',
  },
  {
    key: 'dice',
    label: 'Dice',
    blurb: 'Multiple member filters',
    detail:
      'Selects a sub-cube by filtering several dimensions simultaneously, producing a focused 3-D selection of the warehouse.',
  },
  {
    key: 'rollup',
    label: 'Rollup',
    blurb: 'Aggregate up the hierarchy',
    detail:
      'Collapses a hierarchy to a coarser level — day to month, city to country — computing subtotals at each aggregation step.',
  },
  {
    key: 'drilldown',
    label: 'Drill-down',
    blurb: 'Expand into children',
    detail:
      'Takes an aggregated member and reveals the members beneath it, walking from year → quarter → month → week → day.',
  },
]

export interface Slice {
  dimension: string
  level: string
  values: string[]
}

export interface OlapRequest {
  operation: OlapOperation
  rowLevels: { dimension: string; level: string }[]
  colLevel: { dimension: string; level: string } | null
  measure: string
  compareMeasure: string | null
  filters: Partial<Filters>
  slices: Slice[]
  /** Members the user has drilled into, keyed by path. */
  expanded: string[]
}

export interface GridNode {
  id: string
  label: string
  depth: number
  /** Value per column member; length === colMembers.length */
  values: number[]
  compare: number[]
  total: number
  children: GridNode[]
  /** Row-level subtotal (rollup) */
  subtotal?: boolean
}

export interface OlapResult {
  rowPath: { dimension: string; level: string; label: string }[]
  colMembers: string[]
  colLabel: string | null
  measure: Measure
  compareMeasure: Measure | null
  rows: GridNode[]
  grandTotal: number[]
  grandTotalValue: number
  scannedOrders: number
  cellCount: number
}

function matchesLevel(order: Order, level: DimensionLevel | undefined, member: string): boolean {
  return level ? level.access(order) === member : false
}

export function runOlap(request: OlapRequest): OlapResult {
  const measure = getMeasure(request.measure)
  const compareMeasure = request.compareMeasure ? getMeasure(request.compareMeasure) : null

  // 1. Date range + dimension filters
  let base = selectOrders(request.filters)

  // 2. Slices (slice / dice)
  for (const slice of request.slices) {
    const level = getLevel(slice.dimension, slice.level)
    if (!level || !slice.values.length) continue
    const allowed = new Set(slice.values)
    base = base.filter((o) => allowed.has(level.access(o)))
  }

  const colLevel = request.colLevel ? getLevel(request.colLevel.dimension, request.colLevel.level) : null
  const colMembers = colLevel
    ? [...new Set(base.map((o) => colLevel.access(o)))].sort(naturalSort)
    : ['']

  const rowLevels = request.rowLevels
    .map((rl) => ({ ...rl, level: getLevel(rl.dimension, rl.level) }))
    .filter((rl): rl is typeof rl & { level: DimensionLevel } => Boolean(rl.level))

  const expanded = new Set(request.expanded)
  let cellCount = 0

  const build = (orders: readonly Order[], depth: number, parentId: string): GridNode[] => {
    if (depth >= rowLevels.length) {
      cellCount += colMembers.length
      return []
    }
    const { level } = rowLevels[depth]
    const members = [...new Set(orders.map((o) => level.access(o)))].sort(naturalSort)

    return members.map((member) => {
      const childOrders = orders.filter((o) => level.access(o) === member)
      const id = parentId ? `${parentId}/${member}` : member
      const node: GridNode = {
        id,
        label: member,
        depth,
        values: [],
        compare: [],
        total: 0,
        children: [],
      }

      for (const cm of colMembers) {
        const cellOrders = colLevel
          ? childOrders.filter((o) => matchesLevel(o, colLevel, cm))
          : childOrders
        const v = measure.compute(cellOrders)
        node.values.push(v)
        node.compare.push(compareMeasure ? compareMeasure.compute(cellOrders) : 0)
        node.total += v
      }

      const isDeepest = depth === rowLevels.length - 1
      const showRollup = request.operation === 'rollup' && depth > 0

      if (!isDeepest && (expanded.size === 0 ? depth === 0 : expanded.has(id) || expanded.has(parentId))) {
        node.children = build(childOrders, depth + 1, id)
      } else if (showRollup) {
        cellCount += colMembers.length
      }

      return node
    })
  }

  const rows = build(base, 0, '')
  const grandTotal = colMembers.map((_, i) => sum(rows.map((r) => r.values[i] ?? 0)))
  const grandTotalValue = sum(grandTotal)

  return {
    rowPath: rowLevels.map((rl) => ({
      dimension: rl.dimension,
      level: rl.level.key,
      label: rl.level.label,
    })),
    colMembers,
    colLabel: colLevel ? (request.colLevel as { level: string }).level : null,
    measure,
    compareMeasure,
    rows,
    grandTotal,
    grandTotalValue,
    scannedOrders: base.length,
    cellCount: rows.length * colMembers.length,
  }
}

function naturalSort(a: string, b: string): number {
  const pa = parseFloat(a)
  const pb = parseFloat(b)
  if (!Number.isNaN(pa) && !Number.isNaN(pb)) return pa - pb
  return a.localeCompare(b, undefined, { numeric: true })
}

/** Distinct members for a level, given the current filter context. */
export function membersOf(
  dimension: string,
  level: string,
  filters: Partial<Filters>,
  slices: Slice[],
): string[] {
  let base = selectOrders(filters)
  for (const slice of slices) {
    if (slice.dimension === dimension && slice.level === level) continue
    const l = getLevel(slice.dimension, slice.level)
    if (!l || !slice.values.length) continue
    const allowed = new Set(slice.values)
    base = base.filter((o) => allowed.has(l.access(o)))
  }
  const l = getLevel(dimension, level)
  if (!l) return []
  return [...new Set(base.map((o) => l.access(o)))].sort(naturalSort)
}

export const MEMBER_LIBRARY = {
  carriers: CARRIERS as readonly string[],
  warehouses: WAREHOUSES.map((w) => `${w.id} · ${w.city}`),
  shippingMethods: SHIPPING_METHODS as readonly string[],
  segments: SEGMENTS as readonly string[],
  packageSizes: PACKAGE_SIZES as readonly string[],
  paymentMethods: PAYMENT_METHODS as readonly string[],
  weather: WEATHER as readonly string[],
}
