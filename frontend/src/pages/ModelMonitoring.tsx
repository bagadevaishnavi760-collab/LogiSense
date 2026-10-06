import { useMemo, useState, type ReactNode } from 'react'
import { Activity, BarChart3, CheckCircle2, Gauge, History, Info, RefreshCw, Target, XCircle } from 'lucide-react'
import { PageHeader } from '../components/layout/Topbar'
import { Panel, PanelBody, PanelHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { EmptyState, ErrorState } from '../components/ui/states'
import { formatPercent } from '../lib/format'
import { FEATURES, MODEL_METADATA } from '../services/ml'
import { cn } from '../lib/cn'
import { TableWrap, THead, TBody, TR, TH, TD } from '../components/ui/table'

type ModelKey = 'classification' | 'regression'

interface ModelView {
  key: ModelKey
  name: string
  family: string
  target: string
  purpose: string
  featureCount: number
  status: 'Validated' | 'Metadata available'
  metrics: { label: string; value: string; detail?: string }[]
}

const LEAKAGE_FIELDS = [
  'actual_delivery_days',
  'actual_delivery_days_target',
  'delivery_attempts',
  'delivery_delay_days',
  'delivery_status',
  'late_delivery',
  'late_delivery_target',
  'tracking_status',
]

function StatusBadge({ status }: { status: ModelView['status'] }) {
  return <Badge variant={status === 'Validated' ? 'success' : 'neutral'}>{status}</Badge>
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md border border-line-soft bg-surface-sunken p-3">
      <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-fg-muted">{label}</p>
      <p className="tnum mt-2 text-xl font-semibold tracking-tight text-fg">{value}</p>
      {detail ? <p className="mt-1 text-2xs text-fg-subtle">{detail}</p> : null}
    </div>
  )
}

function ModelCard({ model }: { model: ModelView }) {
  return (
    <Panel>
      <PanelHeader
        title={model.name}
        description={model.purpose}
        actions={<StatusBadge status={model.status} />}
      />
      <PanelBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><p className="text-2xs uppercase tracking-[0.08em] text-fg-subtle">Model type</p><p className="mt-1 text-sm font-medium text-fg">{model.family}</p></div>
          <div><p className="text-2xs uppercase tracking-[0.08em] text-fg-subtle">Target</p><p className="mt-1 break-all text-sm font-medium text-fg">{model.target}</p></div>
          <div><p className="text-2xs uppercase tracking-[0.08em] text-fg-subtle">Input features</p><p className="mt-1 text-sm font-medium text-fg">{model.featureCount}</p></div>
          <div><p className="text-2xs uppercase tracking-[0.08em] text-fg-subtle">Training dataset size</p><p className="mt-1 text-sm font-medium text-fg">Not recorded</p></div>
          <div><p className="text-2xs uppercase tracking-[0.08em] text-fg-subtle">Training date / version</p><p className="mt-1 text-sm font-medium text-fg">Not recorded</p></div>
          <div><p className="text-2xs uppercase tracking-[0.08em] text-fg-subtle">Artifact</p><p className="mt-1 break-all text-sm font-medium text-fg">{model.key === 'classification' ? MODEL_METADATA.classification.artifact : MODEL_METADATA.regression.artifact}</p></div>
        </div>
        <div className="border-t border-line-soft pt-4">
          <p className="mb-3 text-2xs font-semibold uppercase tracking-[0.09em] text-fg-muted">Evaluation metrics</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{model.metrics.map((metric) => <Metric key={metric.label} {...metric} />)}</div>
        </div>
      </PanelBody>
    </Panel>
  )
}

export default function ModelMonitoring() {
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const report = useMemo(() => {
    try {
      const featureCount = FEATURES.length
      const classification = MODEL_METADATA.classification
      const regression = MODEL_METADATA.regression
      return {
        models: [
          {
            key: 'classification' as const,
            name: classification.name,
            family: `${classification.family}${classification.tuned ? ' · tuned' : ''}`,
            target: classification.target,
            purpose: 'Classifies whether a delivery is likely to be late before fulfillment.',
            featureCount,
            status: 'Validated' as const,
            metrics: [
              { label: 'Accuracy', value: formatPercent(classification.metrics.accuracy * 100, 2) },
              { label: 'Precision', value: formatPercent(classification.metrics.precision * 100, 2) },
              { label: 'Recall', value: formatPercent(classification.metrics.recall * 100, 2) },
              { label: 'F1 score', value: formatPercent(classification.metrics.f1 * 100, 2) },
              { label: 'ROC-AUC', value: classification.metrics.rocAuc.toFixed(4) },
              { label: 'Threshold', value: classification.threshold.toFixed(2), detail: 'Operating classification threshold' },
            ],
          },
          {
            key: 'regression' as const,
            name: regression.name,
            family: regression.family,
            target: regression.target,
            purpose: 'Estimates actual delivery duration in days for a prospective order.',
            featureCount,
            status: 'Validated' as const,
            metrics: [
              { label: 'MAE', value: regression.metrics.mae.toFixed(4), detail: 'Days' },
              { label: 'RMSE', value: regression.metrics.rmse.toFixed(4), detail: 'Days' },
              { label: 'R²', value: regression.metrics.r2.toFixed(4) },
            ],
          },
        ] satisfies ModelView[],
        featureCount,
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Model metadata could not be loaded.')
      return null
    }
  }, [refresh])

  const refreshMetadata = () => {
    setLoading(true)
    setError(null)
    window.setTimeout(() => {
      setRefresh((value) => value + 1)
      setLoading(false)
    }, 0)
  }

  if (loading || (!report && !error)) return <div className="space-y-5"><PageHeader title="Model Monitoring" description="Review model health, evaluation evidence and monitoring readiness." /><div className="grid gap-5 xl:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-[430px] animate-pulse rounded-lg border border-line bg-surface-sunken" />)}</div></div>
  if (error || !report) return <div className="space-y-5"><PageHeader title="Model Monitoring" description="Review model health, evaluation evidence and monitoring readiness." /><ErrorState title="Model metadata unavailable" description={error ?? 'No model metadata is available.'} onRetry={refreshMetadata} /></div>
  if (report.models.length === 0) return <div className="space-y-5"><PageHeader title="Model Monitoring" description="Review model health, evaluation evidence and monitoring readiness." /><EmptyState title="No model metadata available" description="The model registry did not return any configured models." /></div>

  const categorical = FEATURES.filter((feature) => feature.type === 'categorical')
  const numeric = FEATURES.filter((feature) => feature.type === 'numeric')
  const derived = FEATURES.filter((feature) => feature.type === 'boolean' || feature.group === 'Time')
  const classification = report.models[0]
  const regression = report.models[1]

  return (
    <div className="space-y-5">
      <PageHeader title="Model Monitoring" description="Review the health, validation evidence and operational readiness of LogiSense's existing ML models." actions={<Button variant="secondary" size="sm" onClick={refreshMetadata} disabled={loading}><RefreshCw className={cn(loading && 'animate-spin')} />Refresh Metadata</Button>} />

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2"><span className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">Model registry status</span><Badge variant="success">Validated metadata available</Badge><span className="ml-auto text-2xs text-fg-subtle">No production telemetry is inferred</span></div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ModelCard model={classification} />
        <ModelCard model={regression} />
      </div>

      <Panel>
        <PanelHeader title="Model comparison" description="The two persisted models solve separate delivery operations problems and share the same 20 input features." />
        <PanelBody><TableWrap><THead><TR><TH>Model</TH><TH>Task</TH><TH>Target</TH><TH align="right">Features</TH><TH>Status</TH><TH>Best available evidence</TH></TR></THead><TBody><TR><TD className="font-medium text-fg">{classification.name}</TD><TD>Classification</TD><TD className="text-xs">{classification.target}</TD><TD align="right" className="tnum">{classification.featureCount}</TD><TD><StatusBadge status={classification.status} /></TD><TD className="text-xs text-fg-muted">F1 {classification.metrics[3].value} · ROC-AUC {classification.metrics[4].value}</TD></TR><TR><TD className="font-medium text-fg">{regression.name}</TD><TD>Regression</TD><TD className="text-xs">{regression.target}</TD><TD align="right" className="tnum">{regression.featureCount}</TD><TD><StatusBadge status={regression.status} /></TD><TD className="text-xs text-fg-muted">MAE {regression.metrics[0].value} days · R² {regression.metrics[2].value}</TD></TR></TBody></TableWrap></PanelBody>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <Panel>
          <PanelHeader title="Feature inputs" description={`${report.featureCount} shared model inputs, grouped by pipeline role.`} />
          <PanelBody className="space-y-5">
            <FeatureGroup title="Categorical" description="One-hot encoded dimensions" items={categorical.map((feature) => feature.label)} tone="bg-brand" />
            <FeatureGroup title="Numeric" description="Scaled continuous and bounded measures" items={numeric.map((feature) => feature.label)} tone="bg-info" />
            <FeatureGroup title="Derived date features" description="Derived from the order date before inference" items={derived.map((feature) => feature.label)} tone="bg-teal" />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Excluded leakage and target fields" description="These fields are intentionally not model inputs." />
          <PanelBody><div className="space-y-2">{LEAKAGE_FIELDS.map((field) => <div key={field} className="flex items-center gap-2 rounded-md border border-line-soft px-3 py-2 text-xs text-fg-secondary"><XCircle className="size-3.5 shrink-0 text-danger" />{field}</div>)}</div></PanelBody>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Model health" description="Status is based only on available persisted metadata and validation metrics." />
          <PanelBody className="space-y-4"><HealthRow icon={<CheckCircle2 />} title={classification.name} detail="Evaluation metrics and operating threshold are present in model metadata." /><HealthRow icon={<CheckCircle2 />} title={regression.name} detail="Holdout MAE, RMSE and R² are present in model metadata." /><HealthRow icon={<Info />} title="Training provenance" detail="Training dataset size, training timestamp and version identifier are not recorded in the available metadata." tone="text-warning" /></PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Monitoring readiness" description="Current capabilities are distinguished from production observability." />
          <PanelBody className="space-y-4"><HealthRow icon={<History />} title="Prediction history" detail="Prediction history not available. No persisted request-level telemetry was found." tone="text-fg-subtle" /><HealthRow icon={<Activity />} title="Drift monitoring" detail="Production drift monitoring is not available. Offline analytical comparisons must not be treated as live telemetry." tone="text-fg-subtle" /><HealthRow icon={<Gauge />} title="Ready for instrumentation" detail="Add request logging, prediction distributions, delayed labels and feature snapshots to enable monitoring." tone="text-info" /></PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Model details" description="Purpose, targets and evaluation interpretation for each persisted model." />
        <PanelBody className="grid gap-5 md:grid-cols-2"><Detail title={classification.name} icon={<Target />} body={`Classification purpose: ${classification.purpose} Target variable: ${classification.target}. Accuracy, precision, recall, F1 and ROC-AUC are holdout evaluation metrics. A probability of ${MODEL_METADATA.classification.threshold.toFixed(2)} or higher is the configured late-delivery decision threshold.`} /><Detail title={regression.name} icon={<BarChart3 />} body={`Regression purpose: ${regression.purpose} Target variable: ${regression.target}. MAE and RMSE are measured in delivery days; R² describes explained variance on the holdout evaluation.`} /></PanelBody>
      </Panel>
    </div>
  )
}

function FeatureGroup({ title, description, items, tone }: { title: string; description: string; items: string[]; tone: string }) {
  return <div><div className="mb-2 flex items-baseline justify-between gap-3"><div><p className="text-sm font-semibold text-fg">{title}</p><p className="text-2xs text-fg-subtle">{description}</p></div><span className="tnum text-2xs text-fg-muted">{items.length}</span></div><div className="flex flex-wrap gap-2">{items.map((item) => <span key={item} className="inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-surface-sunken px-2.5 py-1.5 text-xs text-fg-secondary"><span className={cn('size-1.5 rounded-full', tone)} />{item}</span>)}</div></div>
}

function HealthRow({ icon, title, detail, tone = 'text-success' }: { icon: ReactNode; title: string; detail: string; tone?: string }) {
  return <div className="flex items-start gap-3 rounded-md border border-line-soft p-3"><span className={cn('mt-0.5 [&_svg]:size-4', tone)}>{icon}</span><div><p className="text-sm font-medium text-fg">{title}</p><p className="mt-1 text-xs leading-5 text-fg-muted">{detail}</p></div></div>
}

function Detail({ title, icon, body }: { title: string; icon: ReactNode; body: string }) {
  return <div className="rounded-lg border border-line-soft bg-surface-sunken p-4"><div className="flex items-center gap-2 text-sm font-semibold text-fg"><span className="text-brand [&_svg]:size-4">{icon}</span>{title}</div><p className="mt-3 text-xs leading-6 text-fg-muted">{body}</p></div>
}
