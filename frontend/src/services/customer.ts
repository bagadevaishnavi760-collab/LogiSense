import { getOrderRows } from '../data/orders'
import { statusOf } from '../data/orders'
import type { OrderRow, OrderStatus } from '../types'
import type { PredictionInput } from './ml'

export interface CustomerProfile {
  id: string
  name: string
  email: string
  city: string
  country: string
  segment: string
  shipments: number
  delivered: number
  late: number
  returned: number
  averageDays: number
}

export interface ShipmentTimelineStep {
  label: string
  detail: string
  complete: boolean
  current: boolean
}

export function customerOrders(customerId: string): OrderRow[] {
  return getOrderRows().filter((order) => order.customerId === customerId)
}

export function customerIds(): string[] {
  return [...new Set(getOrderRows().map((order) => order.customerId))].sort()
}

export function profileFor(customerId: string): CustomerProfile | null {
  const orders = customerOrders(customerId)
  const first = orders[0]
  if (!first) return null

  return {
    id: customerId,
    name: first.city,
    email: `${customerId.toLowerCase()}@customer.logisense.local`,
    city: first.city,
    country: first.country,
    segment: first.segment,
    shipments: orders.length,
    delivered: orders.filter((order) => statusOf(order) === 'Delivered').length,
    late: orders.filter((order) => order.late).length,
    returned: orders.filter((order) => statusOf(order) === 'Returned').length,
    averageDays: orders.reduce((total, order) => total + order.actualDays, 0) / Math.max(orders.length, 1),
  }
}

export function orderStatus(order: OrderRow): OrderStatus {
  return statusOf(order)
}

export function promisedDate(order: OrderRow): string {
  const date = new Date(`${order.date}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + order.promisedDays)
  return date.toISOString().slice(0, 10)
}

export function estimatedDate(order: OrderRow): string {
  const date = new Date(`${order.date}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + Math.max(order.predictedDays, order.actualDays))
  return date.toISOString().slice(0, 10)
}

export function shipmentTimeline(order: OrderRow): ShipmentTimelineStep[] {
  const status = statusOf(order)
  const delivered = status === 'Delivered' || status === 'Returned'
  const delayed = status === 'Delayed' || status === 'Exception'
  return [
    { label: 'Order placed', detail: order.date, complete: true, current: false },
    { label: 'Processing', detail: `${order.processingHours.toFixed(1)} hours at ${order.warehouseCity}`, complete: true, current: false },
    { label: 'In transit', detail: `${order.carrier} · ${order.shippingMethod}`, complete: delivered || delayed || status === 'In Transit', current: status === 'In Transit' },
    { label: delivered ? (status === 'Returned' ? 'Return recorded' : 'Delivered') : 'Delivery', detail: delivered ? (status === 'Returned' ? `${order.attempts} attempt${order.attempts === 1 ? '' : 's'}` : `Completed in ${order.actualDays} days`) : `Estimated ${estimatedDate(order)}`, complete: delivered, current: !delivered },
  ]
}

export function predictionInputFor(order: OrderRow): PredictionInput {
  const date = new Date(`${order.date}T00:00:00Z`)
  const dayOfWeek = (date.getUTCDay() + 6) % 7
  return {
    customer_segment: order.segment,
    customer_city: order.city,
    customer_country: order.country,
    warehouse_id: order.warehouseId,
    warehouse_city: order.warehouseCity,
    product_category: order.category,
    product_weight_kg: order.weightKg,
    order_value_usd: order.orderValue,
    shipping_method: order.shippingMethod,
    carrier: order.carrier,
    distance_km: order.distanceKm,
    promised_delivery_days: order.promisedDays,
    shipping_cost_usd: order.shippingCost,
    package_size: order.packageSize,
    payment_method: order.paymentMethod,
    order_year: order.year,
    order_month: order.month,
    order_day: date.getUTCDate(),
    order_dayofweek: dayOfWeek,
    order_is_weekend: dayOfWeek >= 5,
  }
}
