/**
 * The single fact table every screen reads from.
 *
 * `lib/warehouse.ts` materialises the star schema (50k deliveries across the
 * conformed dimensions). Here we enrich each row with the fields the product
 * surfaces — customer key, ML risk score and predicted transit time — using the
 * exact 20-feature schema persisted in `models/model_metadata.json`.
 *
 * Enrichment is deterministic and memoised, so the table is built once per
 * session and every page reconciles against identical numbers.
 */

import { getOrders, type Order } from '../lib/warehouse'
import { estimateDaysCore, scoreRiskCore, type ExtendedInput } from '../services/ml'
import type { OrderRow, OrderStatus } from '../types'
import { createRng } from '../lib/utils'

let cache: OrderRow[] | null = null

function toInput(o: Order): ExtendedInput {
  return {
    customer_segment: o.segment,
    customer_city: o.city,
    customer_country: o.country,
    warehouse_id: o.warehouseId,
    warehouse_city: o.warehouseCity,
    product_category: o.category,
    product_weight_kg: o.weightKg,
    order_value_usd: o.orderValue,
    shipping_method: o.shippingMethod,
    carrier: o.carrier,
    distance_km: o.distanceKm,
    promised_delivery_days: o.promisedDays,
    shipping_cost_usd: o.shippingCost,
    package_size: o.packageSize,
    payment_method: o.paymentMethod,
    order_year: o.year,
    order_month: o.month,
    order_day: new Date(Date.UTC(2026, 0, 1 + o.dayIndex)).getUTCDate(),
    order_dayofweek: o.dayOfWeek,
    order_is_weekend: o.isWeekend,
    weather: o.weather,
    order_priority: o.priority,
  }
}

export function getOrderRows(): OrderRow[] {
  if (cache) return cache

  const rng = createRng('logisense-order-rows-v1')
  const base = getOrders()

  const rows: OrderRow[] = base.map((o) => {
    const input = toInput(o)
    const risk = scoreRiskCore(input)
    return {
      ...o,
      customerId: `CUS-${String(rng.int(1, 49999)).padStart(6, '0')}`,
      riskScore: Math.round(risk.probability * 100),
      riskLevel: risk.band,
      predictedDays: estimateDaysCore(input),
    }
  })

  cache = rows
  return rows
}

/* ------------------------------------------------------------------ *
 * Delivery status taxonomy
 * ------------------------------------------------------------------ */

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'Delivered',
  'In Transit',
  'Delayed',
  'Returned',
  'Exception',
]

export function statusOf(o: Order): OrderStatus {
  if (o.status === 'Delayed') return 'Delayed'
  if (o.returned && o.attempts > 1) return 'Returned'
  if (o.attempts >= 3 || (o.late && o.delayDays >= 6)) return 'Exception'
  if (o.late) return 'In Transit'
  return 'Delivered'
}
