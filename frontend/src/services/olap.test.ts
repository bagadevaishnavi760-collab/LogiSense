import { describe, expect, it } from 'vitest'
import { runOlap, type OlapRequest } from './olap'

const baseRequest: OlapRequest = {
  operation: 'pivot',
  rowLevels: [{ dimension: 'carrier', level: 'carrier' }],
  colLevel: null,
  measure: 'orders',
  compareMeasure: null,
  filters: {},
  slices: [],
  expanded: [],
}

function request(overrides: Partial<OlapRequest>): OlapRequest {
  return { ...baseRequest, ...overrides }
}

describe('OLAP calculations', () => {
  it('calculates a slice from one selected member', () => {
    const all = runOlap(request({ operation: 'pivot' }))
    const sliced = runOlap(request({
      operation: 'slice',
      slices: [{ dimension: 'carrier', level: 'carrier', values: ['EagleCourier'] }],
    }))

    expect(sliced.scannedOrders).toBeGreaterThan(0)
    expect(sliced.scannedOrders).toBeLessThan(all.scannedOrders)
    expect(sliced.grandTotalValue).toBe(sliced.scannedOrders)
    expect(sliced.filtersApplied).toBe(1)
  })

  it('applies all dice filters together', () => {
    const result = runOlap(request({
      operation: 'dice',
      slices: [
        { dimension: 'carrier', level: 'carrier', values: ['EagleCourier'] },
        { dimension: 'segment', level: 'segment', values: ['Consumer'] },
      ],
    }))

    expect(result.scannedOrders).toBeGreaterThan(0)
    expect(result.filtersApplied).toBe(2)
    expect(result.grandTotalValue).toBe(result.scannedOrders)
  })

  it('produces pivot intersections and totals from the filtered order set', () => {
    const result = runOlap(request({
      rowLevels: [{ dimension: 'carrier', level: 'carrier' }],
      colLevel: { dimension: 'segment', level: 'segment' },
    }))

    expect(result.colMembers.length).toBeGreaterThan(1)
    expect(result.rows.length).toBeGreaterThan(1)
    expect(result.rows[0].values).toHaveLength(result.colMembers.length)
    expect(result.grandTotalValue).toBe(result.scannedOrders)
    expect(result.grandTotal.reduce((total, value) => total + value, 0))
      .toBe(result.grandTotalValue)
  })

  it('supports explicit sum, average, minimum, and maximum aggregation', () => {
    const sums = runOlap(request({ measure: 'revenue', aggregation: 'sum' }))
    const averages = runOlap(request({ measure: 'revenue', aggregation: 'average' }))
    const minimums = runOlap(request({ measure: 'revenue', aggregation: 'minimum' }))
    const maximums = runOlap(request({ measure: 'revenue', aggregation: 'maximum' }))

    expect(sums.grandTotalValue).toBeGreaterThan(averages.grandTotalValue)
    expect(minimums.grandTotalValue).toBeLessThanOrEqual(averages.grandTotalValue)
    expect(maximums.grandTotalValue).toBeGreaterThanOrEqual(averages.grandTotalValue)
  })

  it('moves date levels for roll-up and drill-down', () => {
    const rollup = runOlap(request({
      operation: 'rollup',
      rowLevels: [{ dimension: 'date', level: 'month' }],
    }))
    const drilldown = runOlap(request({
      operation: 'drilldown',
      rowLevels: [{ dimension: 'date', level: 'month' }],
    }))

    expect(rollup.rowPath[0].level).toBe('quarter')
    expect(drilldown.rowPath[0].level).toBe('week')
    expect(rollup.scannedOrders).toBe(drilldown.scannedOrders)
  })

  it('returns an empty analytical result for an unmatched filter', () => {
    const result = runOlap(request({
      operation: 'dice',
      slices: [{ dimension: 'carrier', level: 'carrier', values: ['Not a carrier'] }],
    }))

    expect(result.scannedOrders).toBe(0)
    expect(result.rows).toHaveLength(0)
    expect(result.grandTotalValue).toBe(0)
    expect(result.grandTotal).toEqual([''].map(() => 0))
  })
})
