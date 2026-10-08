import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Home,
  LogOut,
  Menu,
  Package,
  Search,
  ShieldAlert,
  Sparkles,
  Truck,
  UserRound,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Banner, EmptyState, ErrorState, KeyValue } from '../components/ui/states'
import { Field, Input, Textarea } from '../components/ui/input'
import { Panel, PanelBody, PanelHeader, Section } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { RiskBadge, StatusBadge } from '../components/common/badges'
import { PageHeader } from '../components/layout/Topbar'
import { formatCurrency, formatDate, formatDays, formatPercent } from '../lib/format'
import { cn } from '../lib/cn'
import { endpoints, postLive } from '../services/api'
import type { PredictionInput } from '../services/ml'
import {
  customerIds,
  customerOrders,
  estimatedDate,
  orderStatus,
  predictionInputFor,
  profileFor,
  promisedDate,
  shipmentTimeline,
} from '../services/customer'
import type { OrderRow } from '../types'

interface RiskResponse {
  late_probability: number
  predicted_late: boolean
  risk_level: 'Low' | 'Moderate' | 'High' | 'Critical'
  confidence: number
  model: string
}

interface DurationResponse {
  predicted_days: number
  low_days: number
  high_days: number
  mae: number
  model: string
}

type PortalNavItem = { to: string; label: string; icon: typeof Home; end?: boolean }
const navItems: PortalNavItem[] = [
  { to: '/customer', label: 'Overview', icon: Home, end: true },
  { to: '/customer/track', label: 'Track shipment', icon: Search },
  { to: '/customer/shipments', label: 'My shipments', icon: Package },
  { to: '/customer/history', label: 'Delivery history', icon: Clock3 },
  { to: '/customer/prediction', label: 'AI prediction', icon: Sparkles },
] 
const utilityItems: PortalNavItem[] = [
  { to: '/customer/notifications', label: 'Notifications', icon: Bell },
  { to: '/customer/feedback', label: 'Feedback', icon: FileText },
  { to: '/customer/profile', label: 'Profile', icon: UserRound },
  { to: '/customer/support', label: 'Support', icon: CircleHelp },
]

function PortalNav({ onLogout }: { onLogout: () => void }) {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const links = (items: PortalNavItem[]) => items.map((item) => {
    const Icon = item.icon
    const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setOpen(false)}
        className={cn('flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors', active ? 'bg-[#e9f0ff] text-[#1d4ed8]' : 'text-[#53627b] hover:bg-[#f0f4fa] hover:text-[#17233d]')}
      >
        <Icon className="size-4" />
        {item.label}
      </Link>
    )
  })
  return (
    <>
      <button type="button" className="fixed right-4 top-4 z-50 rounded-md border border-[#dbe3f0] bg-white p-2 text-[#53627b] shadow-sm lg:hidden" onClick={() => setOpen((value) => !value)} aria-label="Open customer navigation">
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[#dbe3f0] bg-white px-4 py-5 transition-transform lg:relative lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <Link to="/customer" className="flex items-center gap-2.5 px-2 pb-7">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#18315f] text-white"><Truck className="size-4" /></span>
          <span><span className="block text-sm font-semibold tracking-tight text-[#17233d]">LogiSense</span><span className="block text-[10px] text-[#7b879b]">Customer portal</span></span>
        </Link>
        <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9aa6b8]">Shipments</div>
        <nav className="flex flex-col gap-1" aria-label="Customer navigation">{links(navItems)}</nav>
        <div className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9aa6b8]">Account</div>
        <nav className="flex flex-col gap-1" aria-label="Account navigation">{links(utilityItems)}</nav>
        <div className="mt-auto space-y-2 border-t border-[#edf0f5] pt-4">
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={onLogout}><LogOut /> Sign out</Button>
          <p className="px-1 text-[10px] leading-4 text-[#9aa6b8]">Your workspace is protected by role-based access.</p>
        </div>
      </aside>
    </>
  )
}

function PortalHeader({ profile }: { profile: ReturnType<typeof profileFor> }) {
  const location = useLocation()
  const current = [...navItems, ...utilityItems].find((item) => location.pathname === item.to || (!item.end && location.pathname.startsWith(`${item.to}/`)))
  return (
    <header className="flex min-h-16 items-center justify-between border-b border-[#dbe3f0] bg-white px-5 py-3 sm:px-8">
      <div className="pl-10 lg:pl-0"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a96a9]">Customer workspace</p><p className="text-sm font-medium text-[#17233d]">{current?.label ?? 'Overview'}</p></div>
      <div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-xs font-semibold text-[#17233d]">{profile?.id ?? 'Customer'}</span><span className="block text-[11px] text-[#7b879b]">{profile?.city}, {profile?.country}</span></span><span className="flex size-8 items-center justify-center rounded-full bg-[#e9f0ff] text-xs font-semibold text-[#1d4ed8]"><UserRound className="size-4" /></span></div>
    </header>
  )
}

function PortalShell({ children, onLogout, profile }: { children: ReactNode; onLogout: () => void; profile: ReturnType<typeof profileFor> }) {
  return <div className="min-h-dvh bg-[#f6f8fb] text-[#17233d] lg:flex"><PortalNav onLogout={onLogout} /><div className="min-w-0 flex-1"><PortalHeader profile={profile} /><main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8">{children}</main></div></div>
}

function ShipmentCard({ order }: { order: OrderRow }) {
  return <Link to={`/customer/shipments/${order.id}`} className="group block rounded-lg border border-[#dbe3f0] bg-white p-4 transition hover:border-[#9eb7e8] hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#edf3ff] text-[#3264cf]"><Package className="size-4" /></span><div className="min-w-0"><p className="truncate font-mono text-xs font-semibold text-[#17233d]">{order.id}</p><p className="mt-0.5 truncate text-xs text-[#7b879b]">{order.carrier} · {order.shippingMethod}</p></div></div><StatusBadge status={orderStatus(order)} size="sm" /></div><div className="mt-4 flex items-end justify-between gap-4"><div><p className="text-[11px] text-[#8a96a9]">Estimated delivery</p><p className="mt-0.5 text-sm font-semibold text-[#17233d]">{formatDate(estimatedDate(order))}</p></div><div className="text-right"><p className="text-[11px] text-[#8a96a9]">Risk</p><RiskBadge level={order.riskLevel} score={order.riskScore} size="sm" /></div></div></Link>
}

function Dashboard({ orders, profile }: { orders: OrderRow[]; profile: ReturnType<typeof profileFor> }) {
  const active = orders.filter((order) => orderStatus(order) !== 'Delivered' && orderStatus(order) !== 'Returned')
  const recent = [...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const atRisk = orders.filter((order) => order.riskScore >= 35).length
  return <div className="space-y-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-[#3264cf]">Welcome back</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#17233d]">Your delivery workspace</h1><p className="mt-1 text-sm text-[#6f7d94]">A clear view of your shipments, delivery estimates, and support options.</p></div><Button asChild variant="primary"><Link to="/customer/track"><Search /> Track a shipment</Link></Button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active shipments" value={active.length} icon={<Truck />} detail="Currently moving through the network" /><Metric label="Delivered" value={profile?.delivered ?? 0} icon={<Check />} detail="Completed deliveries in this account" /><Metric label="Average delivery" value={formatDays(profile?.averageDays ?? 0)} icon={<Clock3 />} detail="Measured from warehouse facts" /><Metric label="At-risk shipments" value={atRisk} icon={<ShieldAlert />} detail="Risk score at or above model threshold" tone={atRisk ? 'warning' : 'default'} /></div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]"><Section title="Active shipments" description="Latest delivery state and model-informed estimate" actions={<Button asChild variant="ghost" size="sm"><Link to="/customer/shipments">View all <ArrowRight /></Link></Button>}>{active.length ? <div className="grid gap-3 sm:grid-cols-2">{active.slice(0, 4).map((order) => <ShipmentCard key={order.id} order={order} />)}</div> : <Panel><EmptyState icon={Package} title="No active shipments" description="All shipments in this customer record are complete." /></Panel>}</Section><Section title="Delivery risk" description="Risk indicators come from the existing LogiSense model"><Panel tone={atRisk ? 'accent' : 'default'}><PanelBody><div className="flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-md bg-[#edf3ff] text-[#3264cf]"><Sparkles className="size-4" /></span><div><p className="text-sm font-semibold text-[#17233d]">{atRisk ? `${atRisk} shipment${atRisk === 1 ? '' : 's'} need attention` : 'No shipments above the risk threshold'}</p><p className="mt-1 text-xs leading-5 text-[#6f7d94]">Risk scores are generated from shipment attributes only. Completed outcomes are not sent to the prediction model.</p></div></div><Button asChild variant="outline" size="sm" className="mt-4"><Link to="/customer/prediction">Run a prediction <ArrowRight /></Link></Button></PanelBody></Panel></Section></div>
    <Section title="Recent shipments" actions={<Button asChild variant="ghost" size="sm"><Link to="/customer/history">Delivery history <ArrowRight /></Link></Button>}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{recent.map((order) => <ShipmentCard key={order.id} order={order} />)}</div></Section>
  </div>
}

function Metric({ label, value, icon, detail, tone = 'default' }: { label: string; value: ReactNode; icon: ReactNode; detail: string; tone?: 'default' | 'warning' }) {
  return <Panel className={tone === 'warning' ? 'border-[#f3d5a6] bg-[#fffaf0]' : undefined}><PanelBody><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[#7b879b]">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-[#17233d]">{value}</p></div><span className="flex size-9 items-center justify-center rounded-md bg-[#edf3ff] text-[#3264cf]">{icon}</span></div><p className="mt-3 text-[11px] leading-4 text-[#8a96a9]">{detail}</p></PanelBody></Panel>
}

function Track({ orders }: { orders: OrderRow[] }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<OrderRow | null>(null)
  const search = () => setSelected(orders.find((order) => order.id.toLowerCase() === query.trim().toLowerCase()) ?? null)
  return <div className="space-y-6"><PageHeader title="Track a shipment" description="Enter an Order ID from your customer workspace to view its warehouse status and delivery estimate." /><Panel><PanelBody><form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); search() }}><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. ORD-000001" aria-label="Order ID" /><Button type="submit" variant="primary">Track shipment</Button></form>{query && !selected ? <p className="mt-3 text-xs text-[#b45309]">No shipment in the selected customer record matches that Order ID.</p> : null}</PanelBody></Panel>{selected ? <ShipmentOverview order={selected} /> : <Panel><EmptyState icon={Search} title="Shipment details will appear here" description="Use an exact Order ID to see its current state, carrier, estimate, and timeline." /></Panel>}</div>
}

function ShipmentOverview({ order }: { order: OrderRow }) {
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-[#7b879b]">{order.id}</p><h2 className="mt-1 text-xl font-semibold text-[#17233d]">{orderStatus(order)}</h2></div><div className="flex items-center gap-2"><StatusBadge status={orderStatus(order)} /><RiskBadge level={order.riskLevel} score={order.riskScore} /></div></div><div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]"><Panel><PanelHeader title="Delivery timeline" description="Progress inferred from the warehouse record" /><PanelBody><div className="space-y-0">{shipmentTimeline(order).map((step, index) => <div key={step.label} className="relative flex gap-3 pb-6 last:pb-0"><div className="relative flex w-5 justify-center"><span className={cn('z-10 mt-0.5 flex size-5 items-center justify-center rounded-full border-2 bg-white', step.complete ? 'border-[#3264cf] bg-[#3264cf] text-white' : 'border-[#cbd5e1] text-transparent')}>{step.complete ? <Check className="size-3" /> : null}</span>{index < shipmentTimeline(order).length - 1 ? <span className={cn('absolute top-5 h-full w-px', step.complete ? 'bg-[#9eb7e8]' : 'bg-[#dbe3f0]')} /> : null}</div><div><p className={cn('text-sm font-semibold', step.current ? 'text-[#3264cf]' : 'text-[#17233d]')}>{step.label}</p><p className="mt-0.5 text-xs text-[#7b879b]">{step.detail}</p></div></div>)}</div></PanelBody></Panel><Panel><PanelHeader title="Shipment summary" /><PanelBody><KeyValue columns={2} items={[{ label: 'Warehouse', value: `${order.warehouseId} · ${order.warehouseCity}` }, { label: 'Carrier', value: order.carrier }, { label: 'Shipping method', value: order.shippingMethod }, { label: 'Order date', value: formatDate(order.date) }, { label: 'Promised delivery', value: formatDate(promisedDate(order)) }, { label: 'Estimated delivery', value: formatDate(estimatedDate(order)) }, { label: 'Package', value: `${order.packageSize} · ${order.weightKg.toFixed(2)} kg` }, { label: 'Shipping cost', value: formatCurrency(order.shippingCost, true) }]} /></PanelBody></Panel></div></div>
}

function Shipments({ orders }: { orders: OrderRow[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [carrier, setCarrier] = useState('all')
  const visible = orders.filter((order) => {
    const text = `${order.id} ${order.carrier} ${order.shippingMethod}`.toLowerCase()
    return (!query || text.includes(query.toLowerCase())) && (status === 'all' || orderStatus(order) === status) && (carrier === 'all' || order.carrier === carrier)
  })
  const carriers = [...new Set(orders.map((order) => order.carrier))]
  return <div className="space-y-6"><PageHeader title="My shipments" description="Search and filter shipments associated with this customer record." /><Panel><PanelBody><div className="grid gap-3 md:grid-cols-[1fr_180px_180px]"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Order ID, carrier, or service" /><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Status filter"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{['Delivered', 'In Transit', 'Delayed', 'Returned', 'Exception'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Select value={carrier} onValueChange={setCarrier}><SelectTrigger aria-label="Carrier filter"><SelectValue placeholder="Carrier" /></SelectTrigger><SelectContent><SelectItem value="all">All carriers</SelectItem>{carriers.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div></PanelBody></Panel>{visible.length ? <Panel><div className="hidden overflow-auto md:block"><table className="w-full text-left text-[13px]"><thead><tr className="border-b border-[#dbe3f0] bg-[#f6f8fb] text-[10px] uppercase tracking-[0.08em] text-[#7b879b]"><th className="px-4 py-3">Shipment</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Carrier</th><th className="px-4 py-3">Order date</th><th className="px-4 py-3">Estimate</th><th className="px-4 py-3 text-right">Risk</th></tr></thead><tbody>{visible.map((order) => <tr key={order.id} className="border-b border-[#edf0f5] last:border-0"><td className="px-4 py-3"><Link className="font-mono text-xs font-semibold text-[#3264cf] hover:underline" to={`/customer/shipments/${order.id}`}>{order.id}</Link><span className="mt-1 block text-xs text-[#8a96a9]">{order.shippingMethod}</span></td><td className="px-4 py-3"><StatusBadge status={orderStatus(order)} size="sm" /></td><td className="px-4 py-3 text-[#53627b]">{order.carrier}</td><td className="px-4 py-3 text-[#53627b]">{formatDate(order.date)}</td><td className="px-4 py-3 text-[#53627b]">{formatDate(estimatedDate(order))}</td><td className="px-4 py-3 text-right"><RiskBadge level={order.riskLevel} score={order.riskScore} size="sm" /></td></tr>)}</tbody></table></div><div className="grid gap-3 p-3 md:hidden">{visible.map((order) => <ShipmentCard key={order.id} order={order} />)}</div></Panel> : <Panel><EmptyState icon={Package} title="No shipments match these filters" description="Try clearing the search or choosing a different status." /></Panel>}</div>
}

function Details({ orders }: { orders: OrderRow[] }) {
  const { pathname } = useLocation()
  const orderId = pathname.split('/').at(-1)
  const order = orders.find((item) => item.id === orderId)
  if (!order) return <ErrorState title="Shipment not found" description="This shipment is not part of the selected customer record." />
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><PageHeader title={`Shipment ${order.id}`} description="Complete shipment information from the LogiSense warehouse." /><Button asChild variant="outline"><Link to="/customer/shipments">Back to shipments</Link></Button></div><ShipmentOverview order={order} /><Panel><PanelHeader title="Prediction context" description="Existing model-derived fields for this shipment" /><PanelBody><KeyValue columns={3} items={[{ label: 'Predicted transit', value: formatDays(order.predictedDays) }, { label: 'Risk score', value: `${order.riskScore}%` }, { label: 'Risk band', value: order.riskLevel }, { label: 'Distance', value: `${order.distanceKm.toFixed(0)} km` }, { label: 'Order value', value: formatCurrency(order.orderValue, true) }, { label: 'Weather', value: order.weather }]} /></PanelBody></Panel></div>
}

function History({ orders, profile }: { orders: OrderRow[]; profile: ReturnType<typeof profileFor> }) {
  const completed = orders.filter((order) => orderStatus(order) === 'Delivered' || orderStatus(order) === 'Returned')
  const late = completed.filter((order) => order.late).length
  return <div className="space-y-6"><PageHeader title="Delivery history" description="Completed delivery performance based on the shipment records available to this customer." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Completed deliveries" value={completed.length} icon={<Check />} detail="Delivered or return-recorded shipments" /><Metric label="Average delivery time" value={formatDays(profile?.averageDays ?? 0)} icon={<Clock3 />} detail="Actual days in the warehouse facts" /><Metric label="Late deliveries" value={late} icon={<ShieldAlert />} detail={completed.length ? formatPercent((late / completed.length) * 100) : 'No completed records'} tone={late ? 'warning' : 'default'} /><Metric label="Returned orders" value={profile?.returned ?? 0} icon={<Package />} detail="Return flag and attempt status" /></div><Panel><PanelHeader title="Completed shipments" /><PanelBody className="p-0"><div className="divide-y divide-[#edf0f5]">{completed.sort((a, b) => b.date.localeCompare(a.date)).map((order) => <Link key={order.id} to={`/customer/shipments/${order.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[#f8faff]"><div><p className="font-mono text-xs font-semibold text-[#3264cf]">{order.id}</p><p className="mt-1 text-xs text-[#7b879b]">{formatDate(order.date)} · {order.carrier} · {order.actualDays} days</p></div><div className="flex items-center gap-3"><StatusBadge status={orderStatus(order)} size="sm" /><ChevronRight className="size-4 text-[#9aa6b8]" /></div></Link>)}</div></PanelBody></Panel></div>
}

function Prediction({ orders }: { orders: OrderRow[] }) {
  const [selectedId, setSelectedId] = useState(orders[0]?.id ?? '')
  const [risk, setRisk] = useState<RiskResponse | null>(null)
  const [duration, setDuration] = useState<DurationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const selected = orders.find((order) => order.id === selectedId)
  const run = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setLoading(true); setError(null); setRisk(null); setDuration(null)
    const input = predictionInputFor(selected)
    try {
      const [riskResult, durationResult] = await Promise.all([
        postLive<RiskResponse, PredictionInput>(endpoints.predict, input),
        postLive<DurationResponse, PredictionInput>(endpoints.predictDuration, input),
      ])
      setRisk(riskResult); setDuration(durationResult)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The saved models could not produce a prediction.')
    } finally { setLoading(false) }
  }
  return <div className="space-y-6"><PageHeader title="AI delivery prediction" description="Run the deployed LogiSense models against an existing shipment. Completed outcomes are never sent as model inputs." /><Banner tone="info" icon={<Sparkles />} title="Model-powered estimate">Results below come directly from the persisted late-risk classifier and delivery-time estimator. They are estimates, not guarantees.</Banner><Panel><PanelBody><form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={run}><Field label="Shipment"><Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger><SelectValue placeholder="Select shipment" /></SelectTrigger><SelectContent>{orders.map((order) => <SelectItem key={order.id} value={order.id}>{order.id} · {order.carrier}</SelectItem>)}</SelectContent></Select></Field><Button type="submit" variant="primary" disabled={loading || !selected}>{loading ? 'Scoring…' : 'Run prediction'} <Sparkles /></Button></form>{error ? <Banner tone="danger" title="Prediction unavailable" className="mt-4">{error} No fallback value has been shown.</Banner> : null}</PanelBody></Panel>{risk && duration ? <div className="grid gap-5 md:grid-cols-2"><Panel tone={risk.predicted_late ? 'accent' : 'default'}><PanelHeader title="Late-delivery risk" description={risk.model} /><PanelBody><div className="flex items-end justify-between gap-4"><div><p className="text-3xl font-semibold text-[#17233d]">{risk.late_probability.toFixed(1)}%</p><p className="mt-1 text-xs text-[#7b879b]">{risk.risk_level} risk · {risk.confidence.toFixed(1)}% model confidence</p></div><RiskBadge level={risk.risk_level} /></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-[#edf0f5]"><div className="h-full rounded-full bg-[#3264cf]" style={{ width: `${Math.min(100, risk.late_probability)}%` }} /></div></PanelBody></Panel><Panel><PanelHeader title="Predicted delivery time" description={duration.model} /><PanelBody><p className="text-3xl font-semibold text-[#17233d]">{duration.predicted_days.toFixed(1)} days</p><p className="mt-1 text-xs text-[#7b879b]">Expected range {duration.low_days.toFixed(1)}–{duration.high_days.toFixed(1)} days · MAE ±{duration.mae.toFixed(2)} days</p></PanelBody></Panel></div> : null}</div>
}

function Notifications({ orders }: { orders: OrderRow[] }) {
  const items = orders.filter((order) => order.riskScore >= 35 || orderStatus(order) === 'Delayed').slice(0, 12)
  return <div className="space-y-6"><PageHeader title="Notifications" description="Shipment alerts generated from the available warehouse records." />{items.length ? <Panel><PanelBody className="divide-y divide-[#edf0f5] p-0">{items.map((order) => <Link key={order.id} to={`/customer/shipments/${order.id}`} className="flex gap-3 px-5 py-4 hover:bg-[#f8faff]"><span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#fff4df] text-[#b45309]"><Bell className="size-4" /></span><div><p className="text-sm font-medium text-[#17233d]">{orderStatus(order) === 'Delayed' ? 'Delivery delay recorded' : 'Shipment risk requires attention'}</p><p className="mt-1 text-xs leading-5 text-[#6f7d94]">{order.id} is with {order.carrier}. Risk score is {order.riskScore}% and the current state is {orderStatus(order).toLowerCase()}.</p></div></Link>)}</PanelBody></Panel> : <Panel><EmptyState icon={Bell} title="No shipment alerts" description="There are no risk or delay alerts for this customer record." /></Panel>}</div>
}

function Feedback({ profile }: { profile: ReturnType<typeof profileFor> }) {
  const [submitted, setSubmitted] = useState(false)
  return <div className="space-y-6"><PageHeader title="Feedback" description="Share feedback about a completed delivery." /><Panel><PanelBody><Banner tone="info" icon={<FileText />} title="API-ready form">No customer feedback persistence endpoint exists in the current Flask backend. This form is intentionally not presented as submitted or saved.</Banner>{submitted ? <p className="mt-5 text-sm text-[#53627b]">Your feedback is ready to be connected to a backend endpoint. Nothing was sent or stored.</p> : <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); setSubmitted(true) }}><Field label="Customer"><Input value={profile?.id ?? ''} readOnly /></Field><Field label="Rating"><select className="h-9 rounded-md border border-[#dbe3f0] bg-white px-3 text-sm" defaultValue="5"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Okay</option><option value="2">2 — Needs improvement</option><option value="1">1 — Poor</option></select></Field><Field label="Comments"><Textarea rows={5} placeholder="Tell us about the delivery experience" /></Field><Button type="submit" variant="primary">Prepare feedback</Button></form>}</PanelBody></Panel></div>
}

function Profile({ profile }: { profile: ReturnType<typeof profileFor> }) {
  return <div className="space-y-6"><PageHeader title="Profile" description="Customer information and account-level shipment statistics." /><div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]"><Panel><PanelHeader title="Customer information" /><PanelBody><KeyValue columns={1} items={[{ label: 'Customer ID', value: profile?.id ?? '—', mono: true }, { label: 'Location', value: `${profile?.city ?? '—'}, ${profile?.country ?? '—'}` }, { label: 'Segment', value: profile?.segment ?? '—' }, { label: 'Email', value: profile?.email ?? '—' }]} /></PanelBody></Panel><Panel><PanelHeader title="Account summary" /><PanelBody><div className="grid gap-4 sm:grid-cols-2"><Metric label="Shipments" value={profile?.shipments ?? 0} icon={<Package />} detail="Warehouse records associated with this preview customer" /><Metric label="Delivered" value={profile?.delivered ?? 0} icon={<Check />} detail="Completed delivery states" /><Metric label="Late" value={profile?.late ?? 0} icon={<ShieldAlert />} detail="Records with a late flag" /><Metric label="Returned" value={profile?.returned ?? 0} icon={<LogOut />} detail="Return and multi-attempt records" /></div></PanelBody></Panel></div></div>
}

function Support() {
  const [prepared, setPrepared] = useState(false)
  return <div className="space-y-6"><PageHeader title="Support" description="Find answers to common shipment questions or prepare a support request." /><div className="grid gap-5 lg:grid-cols-2"><Panel><PanelHeader title="Common questions" /><PanelBody className="space-y-4 text-sm text-[#53627b]"><details><summary className="cursor-pointer font-medium text-[#17233d]">What does the risk indicator mean?</summary><p className="mt-2 text-xs leading-5">It is the late-delivery probability produced by the deployed classifier for the selected shipment attributes.</p></details><details><summary className="cursor-pointer font-medium text-[#17233d]">Why can an estimate change?</summary><p className="mt-2 text-xs leading-5">The estimator reflects the shipment attributes and the model’s learned delivery-time patterns; it is not a live carrier scan.</p></details><details><summary className="cursor-pointer font-medium text-[#17233d]">Where can I find my Order ID?</summary><p className="mt-2 text-xs leading-5">Order IDs are shown in My shipments and on every shipment detail page.</p></details></PanelBody></Panel><Panel><PanelHeader title="Contact support" description="Prepared locally; no support submission endpoint is available." /><PanelBody>{prepared ? <Banner tone="success" title="Request prepared">The form is ready for a support endpoint, but no message was submitted or stored.</Banner> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setPrepared(true) }}><Field label="Subject"><Input required placeholder="What can we help with?" /></Field><Field label="Message"><Textarea required rows={5} placeholder="Include your Order ID and a short description" /></Field><Button type="submit" variant="primary">Prepare request</Button></form>}</PanelBody></Panel></div></div>
}

export default function CustomerPortal() {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const customerId = user?.customerId && customerIds().includes(user.customerId) ? user.customerId : (customerIds()[0] ?? '')
  const orders = useMemo(() => customerOrders(customerId), [customerId])
  const profile = useMemo(() => profileFor(customerId), [customerId])
  let content: ReactNode
  if (location.pathname === '/customer' || location.pathname === '/customer/') content = <Dashboard orders={orders} profile={profile} />
  else if (location.pathname === '/customer/track') content = <Track orders={orders} />
  else if (location.pathname === '/customer/shipments') content = <Shipments orders={orders} />
  else if (location.pathname.startsWith('/customer/shipments/')) content = <Details orders={orders} />
  else if (location.pathname === '/customer/history') content = <History orders={orders} profile={profile} />
  else if (location.pathname === '/customer/prediction') content = <Prediction orders={orders} />
  else if (location.pathname === '/customer/notifications') content = <Notifications orders={orders} />
  else if (location.pathname === '/customer/feedback') content = <Feedback profile={profile} />
  else if (location.pathname === '/customer/profile') content = <Profile profile={profile} />
  else if (location.pathname === '/customer/support') content = <Support />
  else content = <ErrorState title="Customer page not found" description="Use the customer navigation to choose a workspace." />
  return <PortalShell onLogout={() => { void signOut().then(() => window.location.assign('/login')) }} profile={profile}>{content}</PortalShell>
}
