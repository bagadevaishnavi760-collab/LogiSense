import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, Info, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { PageHeader } from '../components/layout/Topbar'
import { Panel, PanelBody, PanelHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { EmptyState, ErrorState } from '../components/ui/states'
import { TableWrap, TBody, TD, TH, THead, TR } from '../components/ui/table'
import { RadialGauge } from '../components/charts/radial'
import { formatNumber, formatPercent } from '../lib/format'
import { dataQuality, type QualityColumn, type QualityReport } from '../services/platform'
import { cn } from '../lib/cn'

function statusFor(report: QualityReport): 'Healthy' | 'Warning' | 'Critical' {
  if (report.columns.some((column) => column.status === 'fail')) return 'Critical'
  if (report.columns.some((column) => column.status === 'warn')) return 'Warning'
  return 'Healthy'
}

function StatusBadge({ status }: { status: QualityColumn['status'] | 'Healthy' | 'Warning' | 'Critical' }) {
  const variant = status === 'pass' || status === 'Healthy' ? 'success' : status === 'warn' || status === 'Warning' ? 'warning' : 'danger'
  return <Badge variant={variant}>{status === 'pass' ? 'Passed' : status === 'warn' ? 'Warning' : status === 'fail' ? 'Failed' : status}</Badge>
}

function MetricCard({ label, value, detail, icon, tone = 'text-brand' }: { label: string; value: string; detail: string; icon: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-md border border-line bg-surface p-3 shadow-hair">
      <div className={cn('flex items-center gap-2 text-fg-subtle', tone)}>{icon}<p className="text-2xs font-semibold uppercase tracking-[0.08em]">{label}</p></div>
      <p className="tnum mt-3 text-lg font-semibold tracking-tight text-fg">{value}</p>
      <p className="mt-1 text-2xs text-fg-subtle">{detail}</p>
    </div>
  )
}

function DistributionBars({ data, max, color }: { data: { label: string; value: number }[]; max: number; color: string }) {
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-fg-secondary">{item.label}</span><span className="tnum text-fg-muted">{formatNumber(item.value)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-sunken"><div className={cn('h-full rounded-full', color)} style={{ width: `${max ? Math.min(100, (item.value / max) * 100) : 0}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

function QualitySkeleton() {
  return <div className="space-y-5" aria-live="polite" aria-label="Calculating data quality"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[106px] animate-pulse rounded-md border border-line bg-surface-sunken" />)}</div><div className="grid gap-5 xl:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[280px] animate-pulse rounded-lg border border-line bg-surface-sunken" />)}</div></div>
}

export default function DataQuality() {
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const report = useMemo<QualityReport | null>(() => {
    try {
      return dataQuality()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Quality checks could not be calculated.')
      return null
    }
  }, [refresh])

  const reload = () => {
    setLoading(true)
    setError(null)
    window.setTimeout(() => {
      setRefresh((value) => value + 1)
      setLoading(false)
    }, 0)
  }

  if (loading || (!report && !error)) return <div className="space-y-5"><PageHeader title="Data Quality & Warehouse Health" description="Monitor the integrity of the warehouse facts and conformed dimensions." /><QualitySkeleton /></div>
  if (error || !report) return <div className="space-y-5"><PageHeader title="Data Quality & Warehouse Health" description="Monitor the integrity of the warehouse facts and conformed dimensions." /><ErrorState title="Quality report unavailable" description={error ?? 'The warehouse checks returned no report.'} onRetry={reload} /></div>

  const status = statusFor(report)
  const failed = report.columns.filter((column) => column.status === 'fail')
  const warnings = report.columns.filter((column) => column.status === 'warn')
  const topIssues = [...report.columns].filter((column) => column.status !== 'pass').sort((a, b) => (a.passed / a.total) - (b.passed / b.total)).slice(0, 5)
  const maxMissing = Math.max(...report.missingDistribution.map((item) => item.value), 1)
  const maxCategories = Math.max(...report.issueDistribution.map((item) => item.value), 1)

  return (
    <div className="space-y-5">
      <PageHeader title="Data Quality & Warehouse Health" description="Monitor the integrity of warehouse facts, conformed dimensions, and delivery data contracts." actions={<Button variant="secondary" size="sm" onClick={reload} disabled={loading}><RefreshCw className={cn(loading && 'animate-spin')} />Refresh Quality Checks</Button>} />
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2"><span className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">Warehouse status</span><StatusBadge status={status} /><span className="ml-auto text-2xs text-fg-subtle">{formatNumber(report.rowsScanned)} fact rows scanned in memory</span></div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Overall Quality Score" value={formatPercent(report.score, 1)} detail="Mean across quality dimensions" icon={<ShieldCheck className="size-4" />} />
        <MetricCard label="Total Records" value={formatNumber(report.totalRecords)} detail="fact_delivery rows" icon={<Database className="size-4" />} tone="text-info" />
        <MetricCard label="Completeness Rate" value={formatPercent(report.completenessRate, 1)} detail="Required fact attributes" icon={<CheckCircle2 className="size-4" />} tone="text-success" />
        <MetricCard label="Duplicate Rate" value={formatPercent(report.duplicateRate, 2)} detail="Duplicate order IDs" icon={<AlertTriangle className="size-4" />} tone="text-warning" />
        <MetricCard label="Valid / Invalid" value={`${formatNumber(report.validRecords)} / ${formatNumber(report.invalidRecords)}`} detail="Rows passing core checks" icon={<CheckCircle2 className="size-4" />} tone="text-teal" />
        <MetricCard label="Quality Issues" value={formatNumber(failed.length + warnings.length)} detail={`${formatNumber(failed.length)} failed · ${formatNumber(warnings.length)} warnings`} icon={<XCircle className="size-4" />} tone="text-danger" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
        <Panel>
          <PanelHeader title="Quality posture" description="Calculated from completeness, validity, uniqueness, consistency and referential checks." />
          <PanelBody className="flex flex-col items-center gap-4"><RadialGauge value={report.score} label="Quality score" caption={status} tone={status === 'Critical' ? 'danger' : status === 'Warning' ? 'warning' : 'success'} height={190} /><div className="grid w-full grid-cols-2 gap-2">{report.dimensions.map((dimension) => <div key={dimension.key} className="rounded-md border border-line-soft p-2"><p className="text-2xs text-fg-muted">{dimension.label}</p><p className="tnum mt-1 text-sm font-semibold text-fg">{formatPercent(dimension.score, 1)}</p></div>)}</div></PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Quality score by dataset" description="Fact and dimension health derived from the current warehouse materialization." />
          <PanelBody><DistributionBars data={report.datasetScores.map((item) => ({ label: item.label, value: item.score }))} max={100} color="bg-brand" /></PanelBody>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel><PanelHeader title="Missing-value distribution" description="Null or empty values found in required fact attributes." /><PanelBody>{report.missingDistribution.every((item) => item.value === 0) ? <EmptyState compact icon={CheckCircle2} title="No missing values detected" /> : <DistributionBars data={report.missingDistribution} max={maxMissing} color="bg-warning" />}</PanelBody></Panel>
        <Panel><PanelHeader title="Issue distribution by category" description="Checks requiring attention, grouped by quality dimension." /><PanelBody>{report.issueDistribution.every((item) => item.value === 0) ? <EmptyState compact icon={CheckCircle2} title="All quality categories passed" /> : <DistributionBars data={report.issueDistribution} max={maxCategories} color="bg-danger" />}</PanelBody></Panel>
      </div>

      <Panel>
        <PanelHeader title="Warehouse health" description="Star-schema tables represented by the current ETL warehouse outputs." />
        <PanelBody><TableWrap><THead><TR><TH>Table</TH><TH>Role</TH><TH align="right">Rows</TH><TH>Grain</TH><TH>Keys</TH><TH>Status</TH></TR></THead><TBody>{report.tables.map((table) => { const score = report.datasetScores.find((item) => item.label === table.name)?.score ?? 100; return <TR key={table.name}><TD className="font-medium text-fg">{table.name}</TD><TD><Badge variant={table.role === 'Fact' ? 'brand' : 'neutral'}>{table.role}</Badge></TD><TD align="right" className="tnum">{formatNumber(table.rows)}</TD><TD className="text-xs">{table.grain}</TD><TD className="text-xs text-fg-muted">{table.keys.join(', ')}</TD><TD><StatusBadge status={score < 97 ? 'fail' : score < 99.5 ? 'warn' : 'pass'} /></TD></TR> })}</TBody></TableWrap></PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Quality checks" description="Field-level checks across the fact table and conformed dimensions." />
        <PanelBody><TableWrap maxHeight={520}><THead><TR><TH>Check name</TH><TH>Dataset / field</TH><TH align="right">Records checked</TH><TH align="right">Issue count</TH><TH align="right">Quality</TH><TH>Status</TH><TH>Description</TH></TR></THead><TBody>{report.columns.map((column) => <TR key={`${column.table}-${column.column}-${column.category}`}><TD className="font-medium text-fg">{column.rule}</TD><TD><span className="block text-xs font-medium text-fg">{column.table}</span><span className="text-2xs text-fg-muted">{column.column}</span></TD><TD align="right" className="tnum">{formatNumber(column.total)}</TD><TD align="right" className={cn('tnum', column.status === 'pass' ? 'text-success' : 'text-danger')}>{formatNumber(column.total - column.passed)}</TD><TD align="right" className="tnum">{formatPercent(column.passed / Math.max(column.total, 1) * 100, 2)}</TD><TD><StatusBadge status={column.status} /></TD><TD className="max-w-[300px] text-xs text-fg-muted">{column.detail}</TD></TR>)}</TBody></TableWrap></PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Top data quality issues" description="The lowest-scoring checks are prioritized for investigation." />
        <PanelBody>{topIssues.length ? <div className="space-y-3">{topIssues.map((issue) => <div key={`${issue.table}-${issue.column}-${issue.category}`} className="flex items-start gap-3 rounded-md border border-line-soft p-3"><span className={cn('mt-0.5', issue.status === 'fail' ? 'text-danger' : 'text-warning')}>{issue.status === 'fail' ? <XCircle className="size-4" /> : <AlertTriangle className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-fg">{issue.table}.{issue.column}</p><StatusBadge status={issue.status} /></div><p className="mt-1 text-xs text-fg-muted">{issue.detail}. {formatNumber(issue.total - issue.passed)} issue{issue.total - issue.passed === 1 ? '' : 's'} detected across {formatNumber(issue.total)} records.</p></div></div>)}</div> : <EmptyState compact icon={Info} title="No quality issues detected" description="All configured quality checks passed." />}</PanelBody>
      </Panel>
    </div>
  )
}
