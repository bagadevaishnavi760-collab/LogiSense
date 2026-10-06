import { useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, CircleHelp, Clock3, Loader2, Package, RotateCcw } from 'lucide-react'
import { PageHeader } from '../components/layout/Topbar'
import { Panel, PanelBody, PanelHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Field, Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { EmptyState, ErrorState } from '../components/ui/states'
import { cn } from '../lib/cn'
import { formatCurrency, formatDays } from '../lib/format'
import { endpoints, postLive } from '../services/api'
import { DEFAULT_INPUT, featureOptions, type PredictionInput } from '../services/ml'

interface ForecastResponse {
  predicted_days: number
  mae: number
  low_days: number
  high_days: number
  model: string
  features: PredictionInput
}

type Validation = Partial<Record<keyof PredictionInput | 'order_date', string>>

const LABELS: Record<keyof PredictionInput, string> = {
  customer_segment: 'Customer segment', customer_city: 'Customer city', customer_country: 'Customer country',
  warehouse_id: 'Warehouse', warehouse_city: 'Warehouse city', product_category: 'Product category',
  product_weight_kg: 'Product weight (kg)', order_value_usd: 'Order value (USD)', shipping_method: 'Shipping method',
  carrier: 'Carrier', distance_km: 'Distance (km)', promised_delivery_days: 'Promised delivery days',
  shipping_cost_usd: 'Shipping cost (USD)', package_size: 'Package size', payment_method: 'Payment method',
  order_year: 'Order year', order_month: 'Order month', order_day: 'Order day',
  order_dayofweek: 'Day of week', order_is_weekend: 'Weekend',
}

const CATEGORICAL_KEYS: (keyof PredictionInput)[] = [
  'customer_segment', 'customer_city', 'customer_country', 'warehouse_id', 'warehouse_city',
  'product_category', 'shipping_method', 'carrier', 'package_size', 'payment_method',
]

const NUMERIC_FIELDS = [
  ['product_weight_kg', 0.1, 52.2, 0.1], ['order_value_usd', 10, 3530.7, 1],
  ['distance_km', 40, 9553.6, 10], ['promised_delivery_days', 0, 15, 1],
  ['shipping_cost_usd', 4, 500, 1],
] as const

function dateValue(input: PredictionInput): string {
  return `${String(input.order_year).padStart(4, '0')}-${String(input.order_month).padStart(2, '0')}-${String(input.order_day).padStart(2, '0')}`
}

function applyDate(value: string, current: PredictionInput): PredictionInput {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return current
  const sundayBasedDay = date.getUTCDay()
  const weekday = (sundayBasedDay + 6) % 7
  return { ...current, order_year: date.getUTCFullYear(), order_month: date.getUTCMonth() + 1, order_day: date.getUTCDate(), order_dayofweek: weekday, order_is_weekend: weekday >= 5 }
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <Field label={label}><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></Field>
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-2xs text-fg-subtle">{label}</span><span className="mt-0.5 block truncate font-medium text-fg">{value}</span></div>
}

export default function DeliveryForecast() {
  const [input, setInput] = useState<PredictionInput>(DEFAULT_INPUT)
  const [date, setDate] = useState(dateValue(DEFAULT_INPUT))
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [validation, setValidation] = useState<Validation>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const options = useMemo(() => new Map(CATEGORICAL_KEYS.map((key) => [key, featureOptions(key as never)])), [])

  const update = <K extends keyof PredictionInput>(key: K, value: PredictionInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }))
    setValidation((current) => ({ ...current, [key]: undefined }))
    setForecast(null)
  }

  const validate = () => {
    const next: Validation = {}
    for (const key of CATEGORICAL_KEYS) if (!String(input[key]).trim()) next[key] = `${LABELS[key]} is required.`
    for (const [key, min, max] of NUMERIC_FIELDS) {
      const value = Number(input[key])
      if (!Number.isFinite(value)) next[key] = `${LABELS[key]} is required.`
      else if (value < min || value > max) next[key] = `Enter a value from ${min} to ${max}.`
    }
    if (!date) next.order_date = 'Order date is required.'
    setValidation(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return
    setLoading(true); setError(null); setForecast(null)
    try {
      setForecast(await postLive<ForecastResponse, PredictionInput>(endpoints.predictDuration, input))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The saved regression model could not produce a forecast.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setInput(DEFAULT_INPUT); setDate(dateValue(DEFAULT_INPUT)); setForecast(null); setValidation({}); setError(null)
  }

  const difference = forecast ? forecast.predicted_days - input.promised_delivery_days : 0
  const potentialDelay = difference > 0

  return (
    <div className="space-y-5">
      <PageHeader title="Delivery Time Forecast" description="Estimate delivery time with the persisted delivery-time regression model before fulfillment." actions={<Button variant="ghost" size="sm" onClick={reset}><RotateCcw />Reset</Button>} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Panel>
          <PanelHeader title="Forecast inputs" description="The form mirrors the 20-feature regression pipeline. Delivery outcomes and target fields are not sent." />
          <PanelBody>
            <form onSubmit={submit} className="space-y-6" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 flex items-start gap-2.5"><ChevronRight className="mt-0.5 size-4 text-brand" /><div><h3 className="text-[13.5px] font-semibold text-fg">Customer and route</h3><p className="text-xs text-fg-muted">Destination, fulfillment origin and service selection.</p></div></div>
                {CATEGORICAL_KEYS.slice(0, 8).map((key) => <SelectField key={key} label={LABELS[key]} value={String(input[key])} options={options.get(key) ?? []} onChange={(value) => update(key, value as never)} />)}
                <Field label={LABELS.promised_delivery_days} hint="Model range: 0–15 days"><Input type="number" min={0} max={15} step={1} value={input.promised_delivery_days} invalid={Boolean(validation.promised_delivery_days)} onChange={(event) => update('promised_delivery_days', Number(event.target.value))} />{validation.promised_delivery_days ? <p className="text-2xs text-danger">{validation.promised_delivery_days}</p> : null}</Field>
              </div>
              <div className="grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-2">
                <div className="sm:col-span-2 flex items-start gap-2.5"><Package className="mt-0.5 size-4 text-brand" /><div><h3 className="text-[13.5px] font-semibold text-fg">Shipment and commercial details</h3><p className="text-xs text-fg-muted">Package profile, value and shipping economics.</p></div></div>
                {CATEGORICAL_KEYS.slice(8).map((key) => <SelectField key={key} label={LABELS[key]} value={String(input[key])} options={options.get(key) ?? []} onChange={(value) => update(key, value as never)} />)}
                {NUMERIC_FIELDS.filter(([key]) => key !== 'promised_delivery_days').map(([key, min, max, step]) => <Field key={key} label={LABELS[key]} hint={`Model range: ${min}–${max}`}><Input type="number" min={min} max={max} step={step} value={Number.isFinite(Number(input[key])) ? Number(input[key]) : ''} invalid={Boolean(validation[key])} onChange={(event) => update(key, Number(event.target.value))} />{validation[key] ? <p className="text-2xs text-danger">{validation[key]}</p> : null}</Field>)}
              </div>
              <div className="grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-2">
                <div className="sm:col-span-2 flex items-start gap-2.5"><CalendarDays className="mt-0.5 size-4 text-brand" /><div><h3 className="text-[13.5px] font-semibold text-fg">Order date</h3><p className="text-xs text-fg-muted">Year, month, day, weekday and weekend flag are derived automatically.</p></div></div>
                <Field label="Order date" hint="Used to derive all date features"><Input type="date" value={date} invalid={Boolean(validation.order_date)} onChange={(event) => { setDate(event.target.value); setInput((current) => applyDate(event.target.value, current)); setForecast(null) }} />{validation.order_date ? <p className="text-2xs text-danger">{validation.order_date}</p> : null}</Field>
                <div className="grid grid-cols-2 gap-2 rounded-md border border-line bg-surface-sunken p-3 text-xs"><span className="text-fg-muted">Year <b className="ml-1 text-fg">{input.order_year}</b></span><span className="text-fg-muted">Month <b className="ml-1 text-fg">{input.order_month}</b></span><span className="text-fg-muted">Day <b className="ml-1 text-fg">{input.order_day}</b></span><span className="text-fg-muted">Weekday <b className="ml-1 text-fg">{input.order_dayofweek}</b></span><span className="col-span-2 text-fg-muted">Weekend <b className="ml-1 text-fg">{input.order_is_weekend ? 'Yes' : 'No'}</b></span></div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-5"><p className="flex items-center gap-1.5 text-2xs text-fg-subtle"><CircleHelp className="size-3.5" />Forecasts come from the saved regression model.</p><Button type="submit" variant="primary" size="lg" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Clock3 />}{loading ? 'Forecasting delivery time…' : 'Forecast Delivery Time'}</Button></div>
            </form>
          </PanelBody>
        </Panel>

        <div className="space-y-5">
          {error ? <Panel><ErrorState title="Forecast unavailable" description={error} onRetry={() => { setError(null); void submit(new Event('submit') as unknown as FormEvent) }} /></Panel> : null}
          {!forecast && !error && !loading ? <Panel><EmptyState icon={Clock3} title="Ready for a delivery forecast" description="Complete the order profile and select Forecast Delivery Time to estimate transit duration." /></Panel> : null}
          {loading ? <Panel><PanelBody className="flex min-h-[360px] flex-col items-center justify-center text-center"><Loader2 className="size-8 animate-spin text-brand" /><p className="mt-4 text-sm font-medium text-fg">Running the saved regression model</p><p className="mt-1 text-xs text-fg-muted">Validating inputs and estimating delivery duration.</p></PanelBody></Panel> : null}
          {forecast ? (
            <Panel>
              <PanelHeader title="Delivery time forecast" description={`${forecast.model} · mean absolute error ${formatDays(forecast.mae)}`} actions={<Badge variant={potentialDelay ? 'warning' : 'success'}>{potentialDelay ? 'Potential Delay' : 'Expected On Time'}</Badge>} />
              <PanelBody className="space-y-5">
                <div className="rounded-lg border border-line-soft bg-surface-sunken p-4">
                  <div className="flex items-end justify-between gap-4"><div><p className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-muted">Predicted delivery time</p><p className="tnum mt-1 text-4xl font-semibold tracking-tight text-fg">{forecast.predicted_days.toFixed(1)} <span className="text-base font-medium text-fg-muted">days</span></p></div><div className={cn('flex items-center gap-1.5 text-sm font-semibold', potentialDelay ? 'text-warning' : 'text-success')}>{potentialDelay ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}{potentialDelay ? `+${difference.toFixed(1)} days` : `${Math.abs(difference).toFixed(1)} days early`}</div></div>
                  <div className="mt-5 space-y-3"><TimelineBar label="Promised delivery" value={input.promised_delivery_days} max={Math.max(forecast.predicted_days, input.promised_delivery_days, 1)} color="bg-brand" /><TimelineBar label="Model forecast" value={forecast.predicted_days} max={Math.max(forecast.predicted_days, input.promised_delivery_days, 1)} color={potentialDelay ? 'bg-warning' : 'bg-success'} /></div>
                  <p className="mt-4 text-xs text-fg-muted">Forecast range: {formatDays(forecast.low_days)}–{formatDays(forecast.high_days)} based on the model holdout MAE.</p>
                </div>
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-line-soft p-4"><div><span className="block text-2xs uppercase tracking-[0.08em] text-fg-subtle">Promised delivery</span><span className="tnum mt-1 block text-lg font-semibold text-fg">{formatDays(input.promised_delivery_days)}</span></div><div><span className="block text-2xs uppercase tracking-[0.08em] text-fg-subtle">Difference</span><span className={cn('tnum mt-1 block text-lg font-semibold', potentialDelay ? 'text-warning' : 'text-success')}>{difference > 0 ? '+' : ''}{formatDays(difference)}</span></div></div>
                <div className="border-t border-line-soft pt-4"><p className="mb-3 text-2xs font-semibold uppercase tracking-[0.09em] text-fg-muted">Order summary</p><div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><SummaryItem label="Carrier" value={input.carrier} /><SummaryItem label="Service" value={input.shipping_method} /><SummaryItem label="Route" value={`${input.distance_km.toLocaleString()} km`} /><SummaryItem label="Destination" value={`${input.customer_city}, ${input.customer_country}`} /><SummaryItem label="Warehouse" value={`${input.warehouse_id} · ${input.warehouse_city}`} /><SummaryItem label="Order value" value={formatCurrency(input.order_value_usd, true)} /><SummaryItem label="Shipping cost" value={formatCurrency(input.shipping_cost_usd, true)} /><SummaryItem label="Package" value={`${input.package_size} · ${input.product_weight_kg} kg`} /></div></div>
              </PanelBody>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function TimelineBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return <div><div className="mb-1 flex justify-between text-xs"><span className="text-fg-muted">{label}</span><span className="tnum font-medium text-fg">{value.toFixed(1)} d</span></div><div className="h-2 overflow-hidden rounded-full bg-surface"><div className={cn('h-full rounded-full transition-[width]', color)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div></div>
}
