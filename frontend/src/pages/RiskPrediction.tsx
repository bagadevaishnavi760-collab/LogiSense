import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CalendarDays, ChevronRight, CircleHelp, Loader2, Package, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/layout/Topbar'
import { Panel, PanelBody, PanelHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Field, Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { ErrorState, EmptyState } from '../components/ui/states'
import { RadialGauge } from '../components/charts/radial'
import { cn } from '../lib/cn'
import { formatCurrency, formatDays, formatPercent } from '../lib/format'
import { endpoints, postLive } from '../services/api'
import {
  DEFAULT_INPUT,
  featureOptions,
  type PredictionInput,
} from '../services/ml'

interface PredictionResponse {
  probability: number
  late_probability: number
  predicted_late: boolean
  risk_level: 'Low' | 'Moderate' | 'High' | 'Critical'
  threshold: number
  confidence: number
  model: string
  features: PredictionInput
}

const FIELD_LABELS: Record<keyof PredictionInput, string> = {
  customer_segment: 'Customer segment',
  customer_city: 'Customer city',
  customer_country: 'Customer country',
  warehouse_id: 'Warehouse',
  warehouse_city: 'Warehouse city',
  product_category: 'Product category',
  product_weight_kg: 'Product weight (kg)',
  order_value_usd: 'Order value (USD)',
  shipping_method: 'Shipping method',
  carrier: 'Carrier',
  distance_km: 'Distance (km)',
  promised_delivery_days: 'Promised delivery days',
  shipping_cost_usd: 'Shipping cost (USD)',
  package_size: 'Package size',
  payment_method: 'Payment method',
  order_year: 'Order year',
  order_month: 'Order month',
  order_day: 'Order day',
  order_dayofweek: 'Day of week',
  order_is_weekend: 'Weekend',
}

const NUMERIC_FIELDS: { key: keyof PredictionInput; min: number; max: number; step: number }[] = [
  { key: 'product_weight_kg', min: 0.1, max: 52.2, step: 0.1 },
  { key: 'order_value_usd', min: 10, max: 3530.7, step: 1 },
  { key: 'distance_km', min: 40, max: 9553.6, step: 10 },
  { key: 'promised_delivery_days', min: 0, max: 15, step: 1 },
  { key: 'shipping_cost_usd', min: 4, max: 500, step: 1 },
]

const CATEGORICAL_FIELDS: { key: keyof PredictionInput; options: string[]; group: string }[] = [
  { key: 'customer_segment', options: featureOptions('customer_segment'), group: 'Customer context' },
  { key: 'customer_city', options: featureOptions('customer_city'), group: 'Customer context' },
  { key: 'customer_country', options: featureOptions('customer_country'), group: 'Customer context' },
  { key: 'warehouse_id', options: featureOptions('warehouse_id'), group: 'Origin and service' },
  { key: 'warehouse_city', options: featureOptions('warehouse_city'), group: 'Origin and service' },
  { key: 'product_category', options: featureOptions('product_category'), group: 'Product and package' },
  { key: 'shipping_method', options: featureOptions('shipping_method'), group: 'Origin and service' },
  { key: 'carrier', options: featureOptions('carrier'), group: 'Origin and service' },
  { key: 'package_size', options: featureOptions('package_size'), group: 'Product and package' },
  { key: 'payment_method', options: featureOptions('payment_method'), group: 'Commercial' },
]

function isoDateFromInput(input: PredictionInput): string {
  const year = String(input.order_year).padStart(4, '0')
  const month = String(input.order_month).padStart(2, '0')
  const day = String(input.order_day).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function inputFromDate(value: string, current: PredictionInput): PredictionInput {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return current
  const sundayBasedDay = date.getUTCDay()
  const pandasDay = (sundayBasedDay + 6) % 7
  return {
    ...current,
    order_year: date.getUTCFullYear(),
    order_month: date.getUTCMonth() + 1,
    order_day: date.getUTCDate(),
    order_dayofweek: pandasDay,
    order_is_weekend: pandasDay >= 5,
  }
}

function riskTone(level: PredictionResponse['risk_level']): 'success' | 'warning' | 'danger' {
  return level === 'Low' ? 'success' : level === 'Moderate' ? 'warning' : 'danger'
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  )
}

function SectionTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-brand [&_svg]:size-4">{icon}</span>
      <div><h3 className="text-[13.5px] font-semibold text-fg">{title}</h3><p className="mt-0.5 text-xs text-fg-muted">{description}</p></div>
    </div>
  )
}

export default function RiskPrediction() {
  const [input, setInput] = useState<PredictionInput>(DEFAULT_INPUT)
  const [orderDate, setOrderDate] = useState(isoDateFromInput(DEFAULT_INPUT))
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [validation, setValidation] = useState<Partial<Record<keyof PredictionInput | 'order_date', string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const update = <K extends keyof PredictionInput>(key: K, value: PredictionInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }))
    setValidation((current) => ({ ...current, [key]: undefined }))
    setPrediction(null)
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof PredictionInput | 'order_date', string>> = {}
    for (const field of CATEGORICAL_FIELDS) {
      if (!String(input[field.key]).trim()) next[field.key] = `${FIELD_LABELS[field.key]} is required.`
    }
    for (const field of NUMERIC_FIELDS) {
      const value = Number(input[field.key])
      if (!Number.isFinite(value)) next[field.key] = `${FIELD_LABELS[field.key]} is required.`
      else if (value < field.min || value > field.max) next[field.key] = `Enter a value from ${field.min} to ${field.max}.`
    }
    if (!orderDate) next.order_date = 'Order date is required.'
    setValidation(next)
    return Object.keys(next).length === 0
  }

  const predict = async (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return
    setLoading(true)
    setError(null)
    setPrediction(null)
    try {
      const result = await postLive<PredictionResponse, PredictionInput>(endpoints.predict, input)
      setPrediction(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The saved model could not produce a prediction.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setInput(DEFAULT_INPUT)
    setOrderDate(isoDateFromInput(DEFAULT_INPUT))
    setValidation({})
    setPrediction(null)
    setError(null)
  }

  const optionMap = useMemo(() => new Map(CATEGORICAL_FIELDS.map((field) => [field.key, field.options])), [])
  const tone = prediction ? riskTone(prediction.risk_level) : 'success'
  const riskPercent = prediction ? prediction.late_probability : 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Delivery Risk Prediction"
        description="Score a prospective delivery with the persisted late-delivery classification model before fulfillment."
        actions={<Button variant="ghost" size="sm" onClick={reset}><RotateCcw />Reset</Button>}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Panel>
          <PanelHeader title="Prediction inputs" description="All fields below match the trained model pipeline. Target and delivery-outcome fields are intentionally excluded." />
          <PanelBody>
            <form onSubmit={predict} className="space-y-6" noValidate>
              <div className="space-y-4">
                <SectionTitle icon={<Package />} title="Customer context" description="Destination and customer profile used by the classifier." />
                <div className="grid gap-4 sm:grid-cols-2">
                  {CATEGORICAL_FIELDS.filter((field) => field.group === 'Customer context').map((field) => (
                    <SelectField key={field.key} label={FIELD_LABELS[field.key]} value={String(input[field.key])} options={optionMap.get(field.key) ?? []} onChange={(value) => update(field.key, value as never)} />
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t border-line-soft pt-5">
                <SectionTitle icon={<ChevronRight />} title="Origin and service" description="Fulfillment origin, carrier and service commitment." />
                <div className="grid gap-4 sm:grid-cols-2">
                  {CATEGORICAL_FIELDS.filter((field) => field.group === 'Origin and service').map((field) => (
                    <SelectField key={field.key} label={FIELD_LABELS[field.key]} value={String(input[field.key])} options={optionMap.get(field.key) ?? []} onChange={(value) => update(field.key, value as never)} />
                  ))}
                  <Field label="Promised delivery days" hint="Model range: 0–15 days">
                    <Input type="number" min={0} max={15} step={1} value={input.promised_delivery_days} invalid={Boolean(validation.promised_delivery_days)} onChange={(event) => update('promised_delivery_days', Number(event.target.value))} />
                    {validation.promised_delivery_days ? <p className="text-2xs text-danger">{validation.promised_delivery_days}</p> : null}
                  </Field>
                </div>
              </div>

              <div className="space-y-4 border-t border-line-soft pt-5">
                <SectionTitle icon={<Package />} title="Product and commercial inputs" description="Shipment characteristics and order economics." />
                <div className="grid gap-4 sm:grid-cols-2">
                  {CATEGORICAL_FIELDS.filter((field) => field.group === 'Product and package' || field.group === 'Commercial').map((field) => (
                    <SelectField key={field.key} label={FIELD_LABELS[field.key]} value={String(input[field.key])} options={optionMap.get(field.key) ?? []} onChange={(value) => update(field.key, value as never)} />
                  ))}
                  {NUMERIC_FIELDS.filter((field) => field.key === 'product_weight_kg' || field.key === 'order_value_usd' || field.key === 'distance_km' || field.key === 'shipping_cost_usd').map((field) => (
                    <Field key={field.key} label={FIELD_LABELS[field.key]} hint={`Model range: ${field.min}–${field.max}`}>
                      <Input type="number" min={field.min} max={field.max} step={field.step} value={Number.isFinite(Number(input[field.key])) ? Number(input[field.key]) : ''} invalid={Boolean(validation[field.key])} onChange={(event) => update(field.key, Number(event.target.value))} />
                      {validation[field.key] ? <p className="text-2xs text-danger">{validation[field.key]}</p> : null}
                    </Field>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t border-line-soft pt-5">
                <SectionTitle icon={<CalendarDays />} title="Order date" description="Date parts are derived automatically and sent in the model’s required format." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Order date" hint="Derived fields: year, month, day, weekday and weekend flag">
                    <Input type="date" value={orderDate} invalid={Boolean(validation.order_date)} onChange={(event) => { setOrderDate(event.target.value); setInput((current) => inputFromDate(event.target.value, current)); setPrediction(null) }} />
                    {validation.order_date ? <p className="text-2xs text-danger">{validation.order_date}</p> : null}
                  </Field>
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-line bg-surface-sunken p-3 text-xs">
                    <span className="text-fg-muted">Year <b className="ml-1 text-fg">{input.order_year}</b></span>
                    <span className="text-fg-muted">Month <b className="ml-1 text-fg">{input.order_month}</b></span>
                    <span className="text-fg-muted">Day <b className="ml-1 text-fg">{input.order_day}</b></span>
                    <span className="text-fg-muted">Weekday <b className="ml-1 text-fg">{input.order_dayofweek}</b></span>
                    <span className="col-span-2 text-fg-muted">Weekend <b className="ml-1 text-fg">{input.order_is_weekend ? 'Yes' : 'No'}</b></span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-5">
                <p className="flex items-center gap-1.5 text-2xs text-fg-subtle"><CircleHelp className="size-3.5" />Predictions are returned by the saved Random Forest classifier.</p>
                <Button type="submit" variant="primary" size="lg" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Sparkles />}{loading ? 'Scoring delivery risk…' : 'Predict Delivery Risk'}</Button>
              </div>
            </form>
          </PanelBody>
        </Panel>

        <div className="space-y-5">
          {error ? <Panel><ErrorState title="Prediction unavailable" description={error} onRetry={() => { setError(null); void predict(new Event('submit') as unknown as FormEvent) }} /></Panel> : null}
          {!prediction && !error && !loading ? (
            <Panel>
              <EmptyState icon={ShieldCheck} title="Ready for a risk prediction" description="Complete the order profile and select Predict Delivery Risk to score the delivery before fulfillment." />
            </Panel>
          ) : null}
          {loading ? (
            <Panel><PanelBody className="flex min-h-[360px] flex-col items-center justify-center text-center"><Loader2 className="size-8 animate-spin text-brand" /><p className="mt-4 text-sm font-medium text-fg">Running the saved classifier</p><p className="mt-1 text-xs text-fg-muted">Validating inputs and evaluating the persisted model pipeline.</p></PanelBody></Panel>
          ) : null}
          {prediction ? (
            <Panel>
              <PanelHeader title="Prediction result" description={`${prediction.model} · threshold ${prediction.threshold.toFixed(2)}`} actions={<Badge variant={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'danger'}>{prediction.risk_level} Risk</Badge>} />
              <PanelBody className="space-y-5">
                <div className="flex flex-col items-center rounded-lg border border-line-soft bg-surface-sunken px-4 py-5">
                  <RadialGauge value={riskPercent} max={100} label="Late risk" caption={`${formatPercent(prediction.threshold * 100, 0)} decision threshold`} tone={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'success'} height={190} />
                  <p className={cn('text-center text-sm font-semibold', prediction.predicted_late ? 'text-danger' : 'text-success')}>{prediction.predicted_late ? 'Likely late delivery' : 'Likely on-time delivery'}</p>
                  <p className="mt-1 text-xs text-fg-muted">Model confidence: {formatPercent(prediction.confidence, 1)}</p>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-2xs font-semibold uppercase tracking-[0.08em] text-fg-muted"><span>Probability scale</span><span className="tnum">{formatPercent(prediction.late_probability, 1)}</span></div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-surface-sunken"><div className={cn('h-full rounded-full', prediction.predicted_late ? 'bg-danger' : 'bg-success')} style={{ width: `${prediction.late_probability}%` }} /><span className="absolute top-[-3px] h-4 w-px bg-fg" style={{ left: `${prediction.threshold * 100}%` }} /></div>
                  <p className="mt-1 text-2xs text-fg-subtle">The vertical marker is the model’s classification threshold.</p>
                </div>
                <div className="border-t border-line-soft pt-4">
                  <p className="mb-3 text-2xs font-semibold uppercase tracking-[0.09em] text-fg-muted">Risk factors / order summary</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <SummaryItem label="Carrier" value={input.carrier} /><SummaryItem label="Service" value={input.shipping_method} />
                    <SummaryItem label="Route" value={`${input.distance_km.toLocaleString()} km`} /><SummaryItem label="Promise" value={formatDays(input.promised_delivery_days)} />
                    <SummaryItem label="Destination" value={`${input.customer_city}, ${input.customer_country}`} /><SummaryItem label="Warehouse" value={`${input.warehouse_id} · ${input.warehouse_city}`} />
                    <SummaryItem label="Order value" value={formatCurrency(input.order_value_usd, true)} /><SummaryItem label="Shipping cost" value={formatCurrency(input.shipping_cost_usd, true)} />
                  </div>
                </div>
              </PanelBody>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-2xs text-fg-subtle">{label}</span><span className="mt-0.5 block truncate font-medium text-fg">{value}</span></div>
}
