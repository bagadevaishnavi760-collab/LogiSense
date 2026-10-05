import { createRng } from './utils'

/* ------------------------------------------------------------------ *
 * Dimension members (mirrors data/processed/dim_*.csv)
 * ------------------------------------------------------------------ */

export const CARRIERS = [
  'EagleCourier',
  'BlueRoute',
  'SpeedyCargo',
  'ParcelPro',
  'GlobalExpress',
  'SwiftShip',
  'PrimeDelivery',
  'FastTrack Logistics',
] as const

export const WAREHOUSES = [
  { id: 'WH-001', city: 'New York' },
  { id: 'WH-002', city: 'Los Angeles' },
  { id: 'WH-003', city: 'Chicago' },
  { id: 'WH-004', city: 'Toronto' },
  { id: 'WH-005', city: 'London' },
  { id: 'WH-006', city: 'Berlin' },
  { id: 'WH-007', city: 'Paris' },
  { id: 'WH-008', city: 'Sydney' },
  { id: 'WH-009', city: 'Dubai' },
  { id: 'WH-010', city: 'Singapore' },
] as const

export const WEATHER = ['Clear', 'Cloudy', 'Rain', 'Storm', 'Snow', 'Extreme Heat'] as const

export const CATEGORIES = [
  'Electronics',
  'Home & Kitchen',
  'Beauty',
  'Grocery',
  'Toys',
  'Health & Personal Care',
  'Automotive',
  'Sports & Fitness',
  'Office Supplies',
  'Books',
  'Fashion',
  'Pet Supplies',
] as const

export const PACKAGE_SIZES = ['Small', 'Medium', 'Large', 'Oversized'] as const
export const SHIPPING_METHODS = ['Same Day', 'Express', 'Standard', 'Economy', 'International'] as const
export const PAYMENT_METHODS = [
  'Credit Card',
  'Debit Card',
  'Digital Wallet',
  'PayPal',
  'Bank Transfer',
  'Cash on Delivery',
] as const
export const ORDER_PRIORITIES = ['Urgent', 'High', 'Normal', 'Low'] as const
export const SEGMENTS = ['Consumer', 'Small Business', 'Enterprise', 'Premium'] as const

/** Real country weights taken from dim_customer.csv. */
const COUNTRY_WEIGHTS: readonly (readonly [string, number])[] = [
  ['United States', 12027],
  ['United Kingdom', 4880],
  ['Canada', 4841],
  ['India', 3904],
  ['Germany', 3438],
  ['France', 2992],
  ['Australia', 2493],
  ['Pakistan', 2010],
  ['Japan', 1970],
  ['Italy', 1545],
  ['Singapore', 1495],
  ['Saudi Arabia', 1480],
  ['Netherlands', 1472],
  ['United Arab Emirates', 1453],
  ['Spain', 1411],
  ['Brazil', 1016],
  ['Mexico', 473],
]

/** Representative destination city per country. */
const COUNTRY_CITIES: Record<string, readonly string[]> = {
  'United States': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Bristol'],
  Canada: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Quebec City'],
  India: ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Pune'],
  Germany: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne'],
  France: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice'],
  Australia: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],
  Pakistan: ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad'],
  Japan: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama'],
  Italy: ['Rome', 'Milan', 'Naples', 'Turin'],
  Singapore: ['Singapore'],
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Dammam'],
  Netherlands: ['Amsterdam', 'Rotterdam', 'Utrecht'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah'],
  Spain: ['Madrid', 'Barcelona', 'Valencia', 'Seville'],
  Brazil: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia'],
  Mexico: ['Mexico City', 'Guadalajara', 'Monterrey'],
}

export const COUNTRIES = COUNTRY_WEIGHTS.map(([c]) => c)

export const TOTAL_ORDERS = 50_000
export const YEAR = 2026
export const DAYS_IN_YEAR = 365
export const START_DATE = `${YEAR}-01-01`

/** Derived from fact_delivery.csv so the UI never contradicts the warehouse. */
export const FACTS = {
  orders: TOTAL_ORDERS,
  lateRate: 56.32,
  onTimeRate: 43.68,
  returnRate: 17.25,
  avgDeliveryDays: 8.35,
  avgPromisedDays: 7.2,
  avgDelayDays: 1.28,
  avgDistanceKm: 2496.8,
  avgOrderValue: 177.92,
  avgShippingCost: 120.52,
  avgRating: 3.37,
  avgAttempts: 1.17,
  avgProcessingHours: 14.41,
  avgWeightKg: 2.26,
} as const

/* ------------------------------------------------------------------ *
 * Order fact table
 * ------------------------------------------------------------------ */

export interface Order {
  id: string
  dayIndex: number
  date: string
  month: number
  quarter: string
  dayOfWeek: number
  isWeekend: boolean
  year: number
  carrier: string
  warehouseId: string
  warehouseCity: string
  country: string
  city: string
  segment: string
  category: string
  packageSize: string
  shippingMethod: string
  paymentMethod: string
  priority: string
  weather: string
  weightKg: number
  orderValue: number
  distanceKm: number
  promisedDays: number
  actualDays: number
  delayDays: number
  shippingCost: number
  rating: number
  attempts: number
  processingHours: number
  late: boolean
  returned: boolean
  status: 'Delivered' | 'Delayed' | 'In Transit'
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dateForIndex(dayIndex: number): Date {
  const d = new Date(Date.UTC(YEAR, 0, 1))
  d.setUTCDate(d.getUTCDate() + dayIndex)
  return d
}

/** Weekly + seasonal + growth demand curve, normalised to TOTAL_ORDERS. */
function dailyDemandWeights(): number[] {
  const rng = createRng('demand-curve')
  const weights: number[] = []
  for (let i = 0; i < DAYS_IN_YEAR; i += 1) {
    const d = dateForIndex(i)
    const dow = d.getUTCDay()
    const month = d.getUTCMonth()
    const weekend = dow === 0 || dow === 6 ? 0.72 : 1
    const growth = 1 + (i / DAYS_IN_YEAR) * 0.22
    const q4 = month >= 9 ? 1 + (month - 9) * 0.07 : 1
    const noise = 0.88 + rng.next() * 0.24
    weights.push(weekend * growth * q4 * noise)
  }
  const total = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => (w / total) * TOTAL_ORDERS)
}

function allocate(weights: readonly number[]): number[] {
  const counts = weights.map((w) => Math.floor(w))
  let remainder = TOTAL_ORDERS - counts.reduce((a, b) => a + b, 0)
  const order = weights
    .map((w, i) => [w - Math.floor(w), i] as const)
    .sort((a, b) => b[0] - a[0])
  let k = 0
  while (remainder > 0) {
    counts[order[k % order.length][1]] += 1
    remainder -= 1
    k += 1
  }
  return counts
}

let cached: Order[] | null = null

/**
 * Deterministically materialise the fact table.
 *
 * Marginals are calibrated against data/processed/fact_delivery.csv, and the
 * late/return flags are applied by rank-cutting a logistic risk score so the
 * headline rates land exactly on the warehouse values while staying correlated
 * with the drivers (distance, carrier, weather, promise).
 */
export function getOrders(): Order[] {
  if (cached) return cached

  const rng = createRng('logisense-warehouse-v1')
  const counts = allocate(dailyDemandWeights())
  const orders: Order[] = []

  const carrierWeights = [
    [CARRIERS[0], 8420],
    [CARRIERS[1], 7180],
    [CARRIERS[2], 6640],
    [CARRIERS[3], 6210],
    [CARRIERS[4], 5780],
    [CARRIERS[5], 5320],
    [CARRIERS[6], 4940],
    [CARRIERS[7], 4510],
  ] as const

  let seq = 0

  for (let dayIndex = 0; dayIndex < DAYS_IN_YEAR; dayIndex += 1) {
    const date = dateForIndex(dayIndex)
    const iso = date.toISOString().slice(0, 10)
    const month = date.getUTCMonth() + 1
    const dow = date.getUTCDay()
    const isWeekend = dow === 0 || dow === 6
    const quarter = `Q${Math.floor((month - 1) / 3) + 1}`

    for (let n = 0; n < counts[dayIndex]; n += 1) {
      seq += 1
      const carrier = rng.weighted(carrierWeights)
      const warehouse = rng.pick(WAREHOUSES)
      const country = rng.weighted(COUNTRY_WEIGHTS)
      const cityList = COUNTRY_CITIES[country] ?? ['Singapore']
      const city = rng.pick(cityList)
      const segment = rng.weighted([
        ['Consumer', 29206],
        ['Small Business', 9855],
        ['Enterprise', 5996],
        ['Premium', 3843],
      ] as const)
      const category = rng.weighted([
        ['Electronics', 9],
        ['Home & Kitchen', 8],
        ['Beauty', 8],
        ['Grocery', 7],
        ['Fashion', 7],
        ['Toys', 6],
        ['Books', 6],
        ['Sports & Fitness', 5],
        ['Pet Supplies', 5],
        ['Automotive', 5],
        ['Health & Personal Care', 4],
        ['Office Supplies', 4],
      ] as const)
      const packageSize = rng.weighted([
        ['Small', 34],
        ['Medium', 38],
        ['Large', 21],
        ['Oversized', 7],
      ] as const)
      const shippingMethod = rng.weighted([
        ['Standard', 34],
        ['Express', 24],
        ['Economy', 20],
        ['International', 15],
        ['Same Day', 7],
      ] as const)
      const paymentMethod = rng.weighted([
        ['Credit Card', 26],
        ['Digital Wallet', 22],
        ['PayPal', 17],
        ['Debit Card', 15],
        ['Bank Transfer', 12],
        ['Cash on Delivery', 8],
      ] as const)
      const priority = rng.weighted([
        ['Normal', 44],
        ['High', 28],
        ['Low', 18],
        ['Urgent', 10],
      ] as const)
      const weather = rng.weighted([
        ['Clear', 30],
        ['Cloudy', 22],
        ['Rain', 17],
        ['Snow', 12],
        ['Storm', 10],
        ['Extreme Heat', 9],
      ] as const)

      const weightKg = round(clampExp(rng.normal(0.42, 0.62), 0.1, 52.2), 2)
      const orderValue = round(clampExp(rng.normal(4.1, 0.82), 10, 3530.7), 2)
      const distanceKm = round(clampLog(rng.normal(7.3, 1.05), 40, 9553.6), 1)

      const methodDays: Record<string, number> = {
        'Same Day': 1.4,
        Express: 3.2,
        Standard: 7.2,
        Economy: 10.4,
        International: 11.6,
      }
      const sizeDays: Record<string, number> = {
        Small: -0.9,
        Medium: 0,
        Large: 1.1,
        Oversized: 2.6,
      }
      const promisedDays = Math.max(
        0,
        Math.round(
          methodDays[shippingMethod] +
            sizeDays[packageSize] +
            rng.normal(0, 1.3) +
            (distanceKm > 6000 ? 1.8 : distanceKm > 3000 ? 0.7 : 0),
        ),
      )

      const processingHours = round(clampExp(rng.normal(2.5, 0.55), 1, 48), 1)
      const carrierSpeed = 1 - carrierIndex(carrier) / (CARRIERS.length * 3.2)
      const weatherPenalty =
        weather === 'Storm' ? 1.5 : weather === 'Snow' ? 1.1 : weather === 'Extreme Heat' ? 0.4 : 0

      const actualDays = Math.max(
        0,
        Math.round(
          promisedDays +
            rng.normal(0.9 + (1 - carrierSpeed) * 4.2, 2.6) +
            weatherPenalty +
            processingHours / 9 -
            (shippingMethod === 'Same Day' ? 0.6 : 0),
        ),
      )

      const shippingCost = round(
        clamp(4 + distanceKm * 0.021 + weightKg * 1.35 + (shippingMethod === 'Same Day' ? 12 : 0), 4, 500),
        1,
      )

      orders.push({
        id: `ORD-${String(seq).padStart(6, '0')}`,
        dayIndex,
        date: iso,
        month,
        quarter,
        dayOfWeek: dow,
        isWeekend,
        year: YEAR,
        carrier,
        warehouseId: warehouse.id,
        warehouseCity: warehouse.city,
        country,
        city,
        segment,
        category,
        packageSize,
        shippingMethod,
        paymentMethod,
        priority,
        weather,
        weightKg,
        orderValue,
        distanceKm,
        promisedDays,
        actualDays,
        delayDays: Math.max(0, actualDays - promisedDays),
        shippingCost,
        rating: 0,
        attempts: 0,
        processingHours,
        late: false,
        returned: false,
        status: 'Delivered',
      })
    }
  }

  applyFlags(orders)
  cached = orders
  return orders
}

function carrierIndex(carrier: string): number {
  const i = CARRIERS.indexOf(carrier as (typeof CARRIERS)[number])
  return i < 0 ? 4 : i
}

/**
 * Rank-cut the logistic risk score so exactly `rate`% of rows are flagged.
 * Guarantees the headline rate matches the warehouse while preserving the
 * relationship between risk and its drivers.
 */
function applyFlags(orders: Order[]): void {
  const rng = createRng('logisense-flags-v1')

  const scored = orders.map((o) => {
    let z =
      -2.15 +
      (o.distanceKm / 1000) * 0.55 +
      (carrierIndex(o.carrier) / 8) * 0.9 +
      (o.promisedDays / 15) * 0.35 +
      (o.packageSize === 'Oversized' ? 0.45 : o.packageSize === 'Large' ? 0.2 : 0) +
      (o.weather === 'Storm' ? 0.6 : o.weather === 'Snow' ? 0.4 : 0) +
      (o.priority === 'Urgent' ? 0.3 : 0) +
      (o.shippingMethod === 'International' ? 0.35 : 0) +
      (o.actualDays - o.promisedDays) * 0.28 +
      (o.processingHours / 48) * 0.3 +
      rng.normal(0, 0.55)

    // Regression-style estimate used for the "actual" outcome.
    const predictedDays = Math.max(
      0,
      o.promisedDays +
        (o.distanceKm / 1000) * 0.55 +
        (carrierIndex(o.carrier) / 8) * 0.9 +
        (o.packageSize === 'Oversized' ? 0.45 : o.packageSize === 'Large' ? 0.2 : 0) +
        (o.weather === 'Storm' ? 0.6 : o.weather === 'Snow' ? 0.4 : 0) +
        (o.processingHours / 48) * 0.3 -
        2.0,
    )
    z = z * 0.6 + (o.actualDays - predictedDays) * 0.4

    const returnZ =
      -2.35 +
      (o.distanceKm / 1000) * 0.3 +
      (o.actualDays - o.promisedDays) * 0.35 +
      (o.packageSize === 'Oversized' ? 0.5 : 0) +
      (o.category === 'Fashion' ? 0.45 : o.category === 'Electronics' ? 0.2 : 0) +
      (o.segment === 'Consumer' ? 0.25 : 0) +
      rng.normal(0, 0.6)

    return { o, z, returnZ }
  })

  scored.sort((a, b) => b.z - a.z)
  const lateCut = Math.round((FACTS.lateRate / 100) * scored.length)
  scored.forEach((s, i) => {
    s.o.late = i < lateCut
  })

  scored.sort((a, b) => b.returnZ - a.returnZ)
  const returnCut = Math.round((FACTS.returnRate / 100) * scored.length)
  scored.forEach((s, i) => {
    s.o.returned = i < returnCut
  })

  for (const o of orders) {
    o.rating = round(clamp(5 - o.delayDays * 0.42 - rng.normal(0.4, 0.75), 1, 5), 0)
    o.attempts = o.late ? (rng.next() < 0.45 ? 2 : 1) : 1
    if (rng.next() < 0.018) o.attempts = 3
    o.status = o.late ? (o.delayDays >= 4 ? 'Delayed' : 'In Transit') : 'Delivered'
  }
}

/* ---------------------------- helpers ----------------------------- */

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

function round(v: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

/** Skew-normal sample: keeps a long right tail, matches weight/value/cost shape. */
function clampExp(v: number, min: number, max: number): number {
  const e = Math.exp(v)
  return clamp(e, min, max)
}

function clampLog(v: number, min: number, max: number): number {
  return clamp(Math.exp(v), min, max)
}

export { dateForIndex }
