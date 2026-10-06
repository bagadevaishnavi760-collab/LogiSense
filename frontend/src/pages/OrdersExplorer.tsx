import { useMemo, useState } from 'react'
import { Search, RotateCcw } from 'lucide-react'
import { PageHeader } from '../components/layout/Topbar'
import { FilterBar, useFilters } from '../components/common/filter-bar'
import { Panel, PanelBody, PanelHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { EmptyState } from '../components/ui/states'
import { TableWrap, TBody, TD, TH, THead, TR } from '../components/ui/table'
import { getOrderRows, statusOf } from '../data/orders'
import { selectOrders } from '../services/analytics'
import { formatCurrency, formatDays, formatNumber } from '../lib/format'
import type { OrderRow } from '../types'

type SortKey = 'id' | 'date' | 'actualDays' | 'delayDays' | 'orderValue'

const PAGE_SIZE = 50

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'Delivered') return 'success'
  if (status === 'Delayed' || status === 'In Transit') return 'warning'
  if (status === 'Returned' || status === 'Exception') return 'danger'
  return 'neutral'
}

function matchesQuery(order: OrderRow, query: string): boolean {
  if (!query.trim()) return true
  const haystack = [
    order.id,
    order.customerId,
    order.carrier,
    order.warehouseId,
    order.country,
    order.city,
    order.category,
    order.shippingMethod,
    statusOf(order),
  ].join(' ').toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

export default function OrdersExplorer() {
  const { filters, clearAll } = useFilters()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' })
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const selected = new Set(selectOrders(filters).map((order) => order.id))
    return getOrderRows().filter((order) => selected.has(order.id) && matchesQuery(order, query))
  }, [filters, query])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const left = a[sort.key]
    const right = b[sort.key]
    const comparison = typeof left === 'string' && typeof right === 'string'
      ? left.localeCompare(right, undefined, { numeric: true })
      : Number(left) - Number(right)
    return sort.direction === 'asc' ? comparison : -comparison
  }), [filtered, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const rows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'date' ? 'desc' : 'asc' })
    setPage(1)
  }

  const reset = () => {
    clearAll()
    setQuery('')
    setPage(1)
    setSort({ key: 'date', direction: 'desc' })
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Orders Explorer" description="Search and inspect delivery orders from the materialized fact table." actions={<Button variant="ghost" size="sm" onClick={reset}><RotateCcw />Reset</Button>} />
      <FilterBar />
      <Panel>
        <PanelHeader title="Order search" description={`${formatNumber(filtered.length)} matching orders`} />
        <PanelBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" /><Input className="pl-9" value={query} placeholder="Search order, customer, carrier, warehouse…" onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></div>
          <p className="text-xs text-fg-muted">Showing {rows.length ? `${(currentPage - 1) * PAGE_SIZE + 1}–${(currentPage - 1) * PAGE_SIZE + rows.length}` : '0'} of {formatNumber(sorted.length)}</p>
        </PanelBody>
        {rows.length === 0 ? <EmptyState compact title="No matching orders" description="Try clearing the search or broadening the active filters." /> : <TableWrap><THead><TR><TH sortable sorted={sort.key === 'id' ? sort.direction : null} onSort={() => toggleSort('id')}>Order</TH><TH sortable sorted={sort.key === 'date' ? sort.direction : null} onSort={() => toggleSort('date')}>Date</TH><TH>Route / carrier</TH><TH>Status</TH><TH sortable align="right" sorted={sort.key === 'actualDays' ? sort.direction : null} onSort={() => toggleSort('actualDays')}>Actual</TH><TH sortable align="right" sorted={sort.key === 'delayDays' ? sort.direction : null} onSort={() => toggleSort('delayDays')}>Delay</TH><TH sortable align="right" sorted={sort.key === 'orderValue' ? sort.direction : null} onSort={() => toggleSort('orderValue')}>Value</TH></TR></THead><TBody>{rows.map((order) => { const status = statusOf(order); return <TR key={order.id}><TD><span className="font-mono text-xs font-medium text-fg">{order.id}</span><span className="mt-0.5 block text-2xs text-fg-muted">{order.customerId}</span></TD><TD className="whitespace-nowrap text-xs">{order.date}</TD><TD><span className="block text-xs font-medium text-fg">{order.warehouseId} → {order.country}</span><span className="mt-0.5 block text-2xs text-fg-muted">{order.carrier} · {order.shippingMethod}</span></TD><TD><Badge variant={statusVariant(status)}>{status}</Badge></TD><TD align="right" className="tnum whitespace-nowrap">{formatDays(order.actualDays)}</TD><TD align="right" className="tnum whitespace-nowrap">{formatDays(order.delayDays)}</TD><TD align="right" className="tnum whitespace-nowrap">{formatCurrency(order.orderValue)}</TD></TR> })}</TBody></TableWrap>}
        <div className="flex items-center justify-between border-t border-line-soft px-4 py-3"><p className="text-xs text-fg-muted">Page {currentPage} of {pageCount}</p><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Button size="sm" variant="secondary" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</Button></div></div>
      </Panel>
    </div>
  )
}
