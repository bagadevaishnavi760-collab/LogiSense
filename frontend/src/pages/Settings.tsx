import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, Database, Gauge, Laptop, Moon, RefreshCw, RotateCcw, Server, Settings2, ShieldCheck, Sun, Cpu, Layers3 } from 'lucide-react'
import { PageHeader } from '../components/layout/Topbar'
import { Panel, PanelBody, PanelHeader } from '../components/ui/card'
import { Badge, Dot } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { EmptyState, ErrorState } from '../components/ui/states'
import { dataQuality, type QualityReport } from '../services/platform'
import { MODEL_METADATA } from '../services/ml'
import { getConnection, onConnectionChange, probeApi, type ConnectionMode } from '../services/api'
import { useTheme, type Theme } from '../hooks/use-theme'
import { formatNumber, formatPercent } from '../lib/format'
import { cn } from '../lib/cn'

type Status = 'Healthy' | 'Warning' | 'Unavailable'

function connectionStatus(mode: ConnectionMode): Status {
  return mode === 'live' ? 'Healthy' : mode === 'demo' ? 'Unavailable' : 'Warning'
}

function StatusBadge({ status }: { status: Status }) {
  const variant = status === 'Healthy' ? 'success' : status === 'Warning' ? 'warning' : 'neutral'
  return <Badge variant={variant}><Dot tone={variant === 'success' ? 'success' : variant === 'warning' ? 'warning' : 'neutral'} />{status}</Badge>
}

function InfoRow({ label, value, detail, icon }: { label: string; value: ReactNode; detail?: string; icon?: ReactNode }) {
  return <div className="flex items-start gap-3 rounded-md border border-line-soft p-3"><span className="mt-0.5 text-fg-subtle [&_svg]:size-4">{icon}</span><div className="min-w-0 flex-1"><p className="text-2xs font-semibold uppercase tracking-[0.08em] text-fg-muted">{label}</p><p className="mt-1 break-words text-sm font-medium text-fg">{value}</p>{detail ? <p className="mt-1 text-xs leading-5 text-fg-muted">{detail}</p> : null}</div></div>
}

function ThemeOption({ label, description, icon, selected, onSelect }: { label: string; description: string; icon: ReactNode; selected: boolean; onSelect: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onSelect} className={cn('flex items-start gap-3 rounded-lg border p-4 text-left transition-colors', selected ? 'border-brand bg-brand-soft' : 'border-line-soft bg-surface-sunken hover:border-line-strong hover:bg-surface-hover')}><span className={cn('mt-0.5 rounded-md border p-2 [&_svg]:size-4', selected ? 'border-brand-line bg-surface text-brand' : 'border-line bg-surface text-fg-subtle')}>{icon}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold text-fg">{label}{selected ? <Check className="size-4 text-brand" /> : null}</span><span className="mt-1 block text-xs leading-5 text-fg-muted">{description}</span></span></button>
}

function modelVersion(artifact: string) {
  return artifact ? 'Artifact registered · version not recorded' : 'Model artifact unavailable'
}

export default function Settings() {
  const { preference, setTheme } = useTheme()
  const [report, setReport] = useState<QualityReport | null>(null)
  const [connection, setConnection] = useState<ConnectionMode>(getConnection())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('Theme changes are saved automatically.')

  const refreshStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReport(dataQuality())
      setConnection(await probeApi())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Settings information could not be loaded.')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
    return onConnectionChange(setConnection)
  }, [refreshStatus])

  const applicationMode = useMemo(() => import.meta.env.MODE || 'unknown', [])
  const warehouseStatus: Status = report && report.totalRecords > 0 ? 'Healthy' : 'Unavailable'
  const qualityStatus: Status = report ? (report.score >= 99 ? 'Healthy' : report.score >= 95 ? 'Warning' : 'Unavailable') : 'Unavailable'
  const apiStatus = connectionStatus(connection)

  const selectTheme = (next: Theme) => {
    setTheme(next)
    setFeedback(`${next === 'system' ? 'System preference' : next === 'dark' ? 'Dark mode' : 'Light mode'} saved.`)
  }

  const resetPreferences = () => {
    setTheme('system')
    setFeedback('Frontend preferences reset to the system theme.')
  }

  if (loading) return <div className="space-y-5"><PageHeader title="Settings" description="Appearance, application information and connected data services." /><div className="grid gap-5 lg:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-56 animate-pulse rounded-lg border border-line bg-surface-sunken" />)}</div></div>
  if (error || !report) return <div className="space-y-5"><PageHeader title="Settings" description="Appearance, application information and connected data services." /><ErrorState title="Settings information unavailable" description={error ?? 'No warehouse status was returned.'} onRetry={() => void refreshStatus()} /></div>
  if (report.tables.length === 0) return <div className="space-y-5"><PageHeader title="Settings" description="Appearance, application information and connected data services." /><EmptyState title="No connected data services" description="The application did not return warehouse metadata." /></div>

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Manage supported frontend preferences and review connected LogiSense services." actions={<Button variant="secondary" size="sm" onClick={() => void refreshStatus()} disabled={loading}><RefreshCw className={cn(loading && 'animate-spin')} />Refresh status</Button>} />

      <Panel>
        <PanelHeader title="Appearance" description="Choose how LogiSense renders across this browser. The preference is stored locally and applies immediately." actions={<span className="text-xs text-fg-muted">{feedback}</span>} />
        <PanelBody><div className="grid gap-3 md:grid-cols-3"><ThemeOption label="Light" description="Use the light enterprise workspace theme." icon={<Sun />} selected={preference === 'light'} onSelect={() => selectTheme('light')} /><ThemeOption label="Dark" description="Use the dark workspace theme for low-light environments." icon={<Moon />} selected={preference === 'dark'} onSelect={() => selectTheme('dark')} /><ThemeOption label="System default" description="Follow the operating system light or dark preference." icon={<Laptop />} selected={preference === 'system'} onSelect={() => selectTheme('system')} /></div></PanelBody>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel><PanelHeader title="Application information" description="Safe runtime information for this frontend deployment." /><PanelBody className="space-y-3"><InfoRow label="Application" value="LogiSense" detail="Supply Chain Intelligence workspace" icon={<Settings2 />} /><InfoRow label="Environment" value={applicationMode} detail="Build/runtime mode exposed by the frontend configuration." icon={<Server />} /><InfoRow label="Technology" value="React · TypeScript · Vite" detail="Enterprise web interface with Recharts analytics components." icon={<Cpu />} /></PanelBody></Panel>
        <Panel><PanelHeader title="Data and warehouse" description="Current warehouse availability from the existing data service." actions={<StatusBadge status={warehouseStatus} />} /><PanelBody className="space-y-3"><InfoRow label="Warehouse status" value={warehouseStatus} detail={`${formatNumber(report.tables.length)} registered tables are available.`} icon={<Database />} /><InfoRow label="Fact records" value={formatNumber(report.totalRecords)} detail="Records currently scanned by the warehouse quality service." icon={<Layers3 />} /><InfoRow label="Quality posture" value={`${formatPercent(report.score, 1)} overall score`} detail="Calculated by the existing centralized data quality checks." icon={<ShieldCheck />} /></PanelBody></Panel>
      </div>

      <Panel><PanelHeader title="Model information" description="Informational metadata from the existing model registry. Model selection is not configurable in this application." /><PanelBody className="grid gap-3 md:grid-cols-2"><InfoRow label="Classification model" value={MODEL_METADATA.classification.name} detail={`${MODEL_METADATA.classification.family} · ${modelVersion(MODEL_METADATA.classification.artifact)} · target: ${MODEL_METADATA.classification.target}`} icon={<Cpu />} /><InfoRow label="Regression model" value={MODEL_METADATA.regression.name} detail={`${MODEL_METADATA.regression.family} · ${modelVersion(MODEL_METADATA.regression.artifact)} · target: ${MODEL_METADATA.regression.target}`} icon={<Cpu />} /><InfoRow label="Classification evidence" value={`F1 ${MODEL_METADATA.classification.metrics.f1.toFixed(4)} · ROC-AUC ${MODEL_METADATA.classification.metrics.rocAuc.toFixed(4)}`} detail={`Configured decision threshold: ${MODEL_METADATA.classification.threshold.toFixed(2)}`} icon={<ShieldCheck />} /><InfoRow label="Regression evidence" value={`MAE ${MODEL_METADATA.regression.metrics.mae.toFixed(4)} days · R² ${MODEL_METADATA.regression.metrics.r2.toFixed(4)}`} detail="Holdout evaluation metadata" icon={<GaugeIcon />} /></PanelBody></Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel><PanelHeader title="Service status" description="Status indicators reflect actual checks, not simulated uptime." /><PanelBody className="space-y-3"><InfoRow label="Backend / API" value={<span className="flex items-center gap-2">{apiStatus}<StatusBadge status={apiStatus} /></span>} detail={connection === 'live' ? 'The existing health endpoint responded successfully.' : connection === 'demo' ? 'The backend did not respond; the app is using its local warehouse fallback.' : 'The health probe is in progress.'} icon={<Server />} /><InfoRow label="Data service" value={<span className="flex items-center gap-2">{warehouseStatus}<StatusBadge status={warehouseStatus} /></span>} detail="Local materialized warehouse service is available to analytics pages." icon={<Database />} /><InfoRow label="Quality checks" value={<span className="flex items-center gap-2">{qualityStatus}<StatusBadge status={qualityStatus} /></span>} detail="Current status derived from the centralized quality score." icon={<ShieldCheck />} /></PanelBody></Panel>
        <Panel><PanelHeader title="Preferences" description="Only browser-level preferences are reset; no data or model files are changed." /><PanelBody><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-fg">Reset frontend preferences</p><p className="mt-1 text-xs leading-5 text-fg-muted">Returns the appearance preference to System default. Warehouse data, models and application services are not affected.</p></div><Button variant="secondary" onClick={resetPreferences}><RotateCcw />Reset preferences</Button></div><p className="mt-4 border-t border-line-soft pt-3 text-xs text-fg-muted">{feedback}</p></PanelBody></Panel>
      </div>
    </div>
  )
}

function GaugeIcon() {
  return <span className="inline-flex"><Gauge className="size-4" /></span>
}
