import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Activity, ArrowRight, CheckCircle2, CircleAlert, Database, FileCheck2, Gauge, Layers3, RefreshCw, Server, ShieldCheck, TriangleAlert, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/Topbar'
import { Panel, PanelBody, PanelHeader } from '../components/ui/card'
import { Badge, Dot } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { EmptyState, ErrorState } from '../components/ui/states'
import { TableWrap, TBody, TD, TH, THead, TR } from '../components/ui/table'
import { dataQuality, type QualityReport, type WarehouseTable } from '../services/platform'
import { MODEL_METADATA } from '../services/ml'
import { getConnection, onConnectionChange, probeApi, type ConnectionMode } from '../services/api'
import { formatNumber, formatPercent } from '../lib/format'
import { cn } from '../lib/cn'

type Status = 'Healthy' | 'Warning' | 'Unavailable'

function statusForConnection(mode: ConnectionMode): Status {
  if (mode === 'live') return 'Healthy'
  if (mode === 'demo') return 'Unavailable'
  return 'Warning'
}

function StatusBadge({ status }: { status: Status }) {
  const variant = status === 'Healthy' ? 'success' : status === 'Warning' ? 'warning' : 'neutral'
  return <Badge variant={variant}><Dot tone={variant === 'success' ? 'success' : variant === 'warning' ? 'warning' : 'neutral'} />{status}</Badge>
}

function Stat({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <div className="rounded-lg border border-line-soft bg-surface-sunken p-4"><div className="flex items-center justify-between gap-3"><span className="text-fg-subtle [&_svg]:size-4">{icon}</span><span className="text-2xs font-semibold uppercase tracking-[0.08em] text-fg-muted">{label}</span></div><p className="tnum mt-3 text-2xl font-semibold tracking-tight text-fg">{value}</p><p className="mt-1 text-xs text-fg-muted">{detail}</p></div>
}

function HealthRow({ title, detail, status, icon }: { title: string; detail: string; status: Status; icon: ReactNode }) {
  return <div className="flex items-start gap-3 rounded-md border border-line-soft p-3"><span className="mt-0.5 text-brand [&_svg]:size-4">{icon}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium text-fg">{title}</p><p className="mt-1 text-xs leading-5 text-fg-muted">{detail}</p></div><StatusBadge status={status} /></div>
}

function TableStatus({ table }: { table: WarehouseTable }) {
  const status: Status = table.rows > 0 ? 'Healthy' : 'Unavailable'
  return <div className="flex items-center gap-2"><Dot tone={status === 'Healthy' ? 'success' : 'neutral'} /><span className="text-xs text-fg-secondary">{status}</span></div>
}

function ModelRow({ name, family, target, metric, available }: { name: string; family: string; target: string; metric: string; available: boolean }) {
  return <TR><TD><div className="font-medium text-fg">{name}</div><div className="mt-0.5 text-2xs text-fg-muted">{family}</div></TD><TD className="max-w-[220px] break-all text-xs">{target}</TD><TD className="text-xs text-fg-secondary">{metric}</TD><TD><StatusBadge status={available ? 'Healthy' : 'Unavailable'} /></TD></TR>
}

function ActionCard({ title, detail, icon, onClick }: { title: string; detail: string; icon: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group flex min-h-[100px] items-start gap-3 rounded-lg border border-line-soft bg-surface-sunken p-4 text-left transition-colors hover:border-brand-line hover:bg-surface-hover"><span className="mt-0.5 rounded-md border border-line bg-surface p-2 text-brand [&_svg]:size-4">{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-fg">{title}</span><span className="mt-1 block text-xs leading-5 text-fg-muted">{detail}</span></span><ArrowRight className="mt-1 size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand" /></button>
}

export default function Admin() {
  const navigate = useNavigate()
  const [report, setReport] = useState<QualityReport | null>(null)
  const [connection, setConnection] = useState<ConnectionMode>(getConnection())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextReport = dataQuality()
      setReport(nextReport)
      const mode = await probeApi()
      setConnection(mode)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'System status could not be loaded.')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return onConnectionChange(setConnection)
  }, [refresh])

  if (loading) return <div className="space-y-5"><PageHeader title="Administration" description="Application, warehouse, data and ML system health." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-lg border border-line bg-surface-sunken" />)}</div><div className="h-80 animate-pulse rounded-lg border border-line bg-surface-sunken" /></div>
  if (error || !report) return <div className="space-y-5"><PageHeader title="Administration" description="Application, warehouse, data and ML system health." /><ErrorState title="System status unavailable" description={error ?? 'No warehouse status was returned.'} onRetry={() => void refresh()} /></div>
  if (report.tables.length === 0) return <div className="space-y-5"><PageHeader title="Administration" description="Application, warehouse, data and ML system health." /><EmptyState title="No warehouse tables available" description="The local warehouse did not return any table metadata." /></div>

  const backendStatus = statusForConnection(connection)
  const dataStatus: Status = report.totalRecords > 0 && report.tables.every((table) => table.rows > 0) ? 'Healthy' : 'Warning'
  const mlStatus: Status = MODEL_METADATA.classification.artifact && MODEL_METADATA.regression.artifact ? 'Healthy' : 'Unavailable'
  const applicationStatus: Status = dataStatus === 'Healthy' && mlStatus === 'Healthy' ? 'Healthy' : 'Warning'
  const qualityStatus: Status = report.score >= 99 ? 'Healthy' : report.score >= 95 ? 'Warning' : 'Unavailable'
  const refreshDetail = connection === 'live' ? 'Connected to the Flask health endpoint.' : connection === 'demo' ? 'Backend unavailable; local warehouse is serving the application.' : 'Backend health probe is in progress.'

  return (
    <div className="space-y-5">
      <PageHeader title="Administration" description="Application, warehouse, data and ML system health." actions={<Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw className={cn(loading && 'animate-spin')} />Refresh Status</Button>} />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-fg">System overview</h2><p className="mt-0.5 text-xs text-fg-muted">Real availability and health signals from the current application session.</p></div><StatusBadge status={applicationStatus} /></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Application" value={applicationStatus} detail="Frontend services operational" icon={<Activity />} />
          <Stat label="Warehouse tables" value={formatNumber(report.tables.length)} detail="Registered star-schema tables" icon={<Database />} />
          <Stat label="Dataset records" value={formatNumber(report.totalRecords)} detail="Fact delivery records scanned" icon={<Layers3 />} />
          <Stat label="ML models" value="2 / 2" detail="Metadata available for both models" icon={<Gauge />} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Panel><PanelHeader title="API and system health" description="Statuses are derived from real service checks and local application state." /><PanelBody className="space-y-3"><HealthRow title="Backend / API" detail={refreshDetail} status={backendStatus} icon={<Server />} /><HealthRow title="Data service" detail={`${formatNumber(report.totalRecords)} records available through the local warehouse service.`} status={dataStatus} icon={<Database />} /><HealthRow title="ML service" detail="Both saved model references and evaluation metadata are available to the frontend registry." status={mlStatus} icon={<Gauge />} /><HealthRow title="Data quality posture" detail={`Overall quality score ${formatPercent(report.score, 1)} across the current warehouse checks.`} status={qualityStatus} icon={<ShieldCheck />} /></PanelBody></Panel>
        <Panel><PanelHeader title="Operational notes" description="What this portal can safely report." /><PanelBody><div className="space-y-3 text-xs leading-5 text-fg-muted"><p className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />Warehouse and model registry metadata are available locally.</p><p className="flex gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />Backend status is unavailable when the health probe falls back to demo data.</p><p className="flex gap-2"><XCircle className="mt-0.5 size-4 shrink-0 text-fg-subtle" />No persisted system event stream is available, so no recent events are fabricated here.</p></div></PanelBody></Panel>
      </div>

      <Panel><PanelHeader title="Data warehouse" description="Registered star-schema tables and their available local materialization." /><PanelBody flush><TableWrap><THead><TR><TH>Table</TH><TH>Role</TH><TH align="right">Records</TH><TH>Columns</TH><TH>Grain</TH><TH>Availability</TH></TR></THead><TBody>{report.tables.map((table) => <TR key={table.name}><TD className="font-mono text-xs font-medium text-fg">{table.name}</TD><TD><Badge variant={table.role === 'Fact' ? 'brand' : 'neutral'}>{table.role}</Badge></TD><TD align="right" className="tnum">{formatNumber(table.rows)}</TD><TD className="tnum">{table.columns}</TD><TD className="max-w-[260px] text-xs">{table.grain}</TD><TD><TableStatus table={table} /></TD></TR>)}</TBody></TableWrap></PanelBody></Panel>

      <Panel><PanelHeader title="ML models" description="Existing saved-model registry metadata; model files are never exposed to the browser." /><PanelBody flush><TableWrap><THead><TR><TH>Model</TH><TH>Target</TH><TH>Evaluation evidence</TH><TH>Status</TH></TR></THead><TBody><ModelRow name={MODEL_METADATA.classification.name} family={MODEL_METADATA.classification.family} target={MODEL_METADATA.classification.target} metric={`F1 ${MODEL_METADATA.classification.metrics.f1.toFixed(4)} · ROC-AUC ${MODEL_METADATA.classification.metrics.rocAuc.toFixed(4)} · threshold ${MODEL_METADATA.classification.threshold.toFixed(2)}`} available={Boolean(MODEL_METADATA.classification.artifact)} /><ModelRow name={MODEL_METADATA.regression.name} family={MODEL_METADATA.regression.family} target={MODEL_METADATA.regression.target} metric={`MAE ${MODEL_METADATA.regression.metrics.mae.toFixed(4)} days · R² ${MODEL_METADATA.regression.metrics.r2.toFixed(4)}`} available={Boolean(MODEL_METADATA.regression.artifact)} /></TBody></TableWrap></PanelBody></Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel><PanelHeader title="Administrative actions" description="Safe navigation and refresh actions already supported by the application." /><PanelBody className="grid gap-3 sm:grid-cols-2"><ActionCard title="Refresh quality checks" detail="Recalculate warehouse quality checks from the local data service." icon={<FileCheck2 />} onClick={() => navigate('/data-quality')} /><ActionCard title="Open data quality" detail="Review completeness, validity and referential checks." icon={<ShieldCheck />} onClick={() => navigate('/data-quality')} /><ActionCard title="Open model monitoring" detail="Review model metadata and monitoring readiness." icon={<Gauge />} onClick={() => navigate('/model-monitoring')} /><ActionCard title="Open warehouse explorer" detail="Slice and inspect the star-schema delivery cube." icon={<Layers3 />} onClick={() => navigate('/olap')} /></PanelBody></Panel>
        <Panel><PanelHeader title="Recent activity" description="System events are shown only when a real event source exists." /><PanelBody><EmptyState compact icon={TriangleAlert} title="No event history available" description="The current application does not persist administrative or system events." /></PanelBody></Panel>
      </div>
    </div>
  )
}
