import { useMemo, useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Drill, Play, Plus, RotateCcw, Trash2, X, AlertCircle, Info } from 'lucide-react'
import { PageHeader } from '../components/layout/Topbar'
import { FilterBar, useFilters } from '../components/common/filter-bar'
import { Panel, PanelBody, PanelHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Hint } from '../components/ui/tooltip'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../components/ui/select'
import { Separator } from '../components/ui/controls'
import { TableWrap, THead, TBody, TR, TH, TD } from '../components/ui/table'
import { cn } from '../lib/cn'
import {
  DIMENSIONS,
  MEASURES,
  OPERATIONS,
  type Measure,
  type OlapRequest,
  type OlapResult,
  type Slice,
  runOlap,
  membersOf,
  getDimension,
  getLevel,
  getMeasure,
} from '../services/olap'
import { formatCompact, formatCompactCurrency, formatCurrency, formatDays, formatKm, formatNumber, formatPercent, formatRatio } from '../lib/format'
import { SERIES } from '../components/charts/theme'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'

const DIMENSION_GROUPS = ['Time', 'Network', 'Customer', 'Product', 'Service'] as const

export default function OLAPExplorer() {
  const { filters } = useFilters()
  const [operation, setOperation] = useState<OlapRequest['operation']>('pivot')
  const [rowDims, setRowDims] = useState<Array<{ dimension: string; level: string }>>([
    { dimension: 'carrier', level: 'carrier' },
  ])
  const [colDim, setColDim] = useState<{ dimension: string; level: string } | null>({
    dimension: 'date',
    level: 'month',
  })
  const [measureKey, setMeasureKey] = useState('revenue')
  const [slices, setSlices] = useState<Slice[]>([])
  const [expanded, setExpanded] = useState<string[]>([])

  const request: OlapRequest = useMemo(
    () => ({
      operation,
      rowLevels: rowDims,
      colLevel: colDim,
      measure: measureKey,
      compareMeasure: null,
      filters,
      slices,
      expanded,
    }),
    [operation, rowDims, colDim, measureKey, filters, slices, expanded],
  )

  const result = useMemo(() => runOlap(request), [request])
  const measure = getMeasure(measureKey)

  const hasData = result.scannedOrders > 0
  const hasResults = result.rows.length > 0

  const addRowDim = () => {
    const used = new Set(rowDims.map((d) => d.dimension))
    const next = DIMENSIONS.find((d) => !used.has(d.key))
    if (next) {
      setRowDims([...rowDims, { dimension: next.key, level: next.levels[0].key }])
    }
  }

  const removeRowDim = (index: number) => {
    setRowDims(rowDims.filter((_, i) => i !== index))
  }

  const updateRowDim = (index: number, field: 'dimension' | 'level', value: string) => {
    const next = [...rowDims]
    if (field === 'dimension') {
      const dim = getDimension(value)
      if (dim) {
        next[index] = { dimension: value, level: dim.levels[0].key }
      }
    } else {
      next[index][field] = value
    }
    setRowDims(next)
  }

  const addSlice = () => {
    const used = new Set(slices.map((s) => s.dimension))
    const next = DIMENSIONS.find((d) => !used.has(d.key))
    if (next) {
      const members = membersOf(next.key, next.levels[0].key, filters as any, [])
      setSlices([...slices, { dimension: next.key, level: next.levels[0].key, values: members.slice(0, 3) }])
    }
  }

  const updateSlice = (index: number, field: keyof Slice, value: string | string[]) => {
    const next = [...slices]
    if (field === 'values') {
      next[index][field] = value as string[]
    } else {
      next[index][field] = value as string
      if (field === 'dimension') {
        const dim = getDimension(value as string)
        if (dim) {
          next[index].level = dim.levels[0].key
          next[index].values = membersOf(value as string, dim.levels[0].key, filters as any, slices).slice(0, 3)
        }
      } else if (field === 'level') {
        next[index].values = membersOf(next[index].dimension, value as string, filters as any, slices).slice(0, 3)
      }
    }
    setSlices(next)
  }

  const removeSlice = (index: number) => {
    setSlices(slices.filter((_, i) => i !== index))
  }

  const toggleExpand = (nodeId: string) => {
    setExpanded((prev) => (prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]))
  }

  const resetQuery = useCallback(() => {
    setRowDims([{ dimension: 'carrier', level: 'carrier' }])
    setColDim({ dimension: 'date', level: 'month' })
    setMeasureKey('revenue')
    setSlices([])
    setExpanded([])
  }, [])

  const clearSlices = useCallback(() => {
    setSlices([])
  }, [])

  const kpiData = useMemo(() => {
    const total = result.grandTotalValue
    const orders = result.scannedOrders
    const measureVal = total
    return [
      { label: 'Measure value', value: measureVal, format: measure.format },
      { label: 'Scanned orders', value: orders, format: 'compact' },
      { label: 'Result cells', value: result.cellCount, format: 'number' },
    ]
  }, [result, measure])

  const chartData = useMemo(() => {
    if (!result.colMembers.length) return []
    return result.rows.map((row) => {
      const obj: Record<string, string | number> = { name: row.label }
      result.colMembers.forEach((col, i) => {
        obj[col] = row.values[i] ?? 0
      })
      return obj
    })
  }, [result])

  const shouldUseLineChart = result.colMembers.length > 5 && result.colMembers.length <= 12

  return (
    <div className="space-y-5">
      <PageHeader
        title="OLAP Explorer"
        description="Slice, dice, roll-up and drill-down through the logistics cube. Pivot dimensions across rows and columns to analyze performance."
        actions={
          <Button variant="ghost" size="sm" onClick={resetQuery}>
            <RotateCcw />
            Reset
          </Button>
        }
      />

      <FilterBar />

      {/* Current Selection Summary */}
      {slices.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2">
          <span className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">Active Filters</span>
          {slices.map((slice, i) => (
            <Badge key={i} variant="neutral" size="sm" className="gap-1">
              {getDimension(slice.dimension)?.label}: {slice.values.length} selected
              <button
                type="button"
                onClick={() => removeSlice(i)}
                className="ml-1 text-fg-subtle transition-colors hover:text-fg"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-4">
        {/* Configuration Panel */}
        <Panel className="xl:col-span-1">
          <PanelHeader title="Cube Configuration" icon={<Drill />} />
          <PanelBody className="space-y-4">
            {/* Operation */}
            <div>
              <label className="mb-2 block text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">
                Operation
              </label>
              <Select value={operation} onValueChange={(v) => setOperation(v as OlapRequest['operation'])}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATIONS.map((op) => (
                    <SelectItem key={op.key} value={op.key}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-fg-muted">{OPERATIONS.find((o) => o.key === operation)?.blurb}</p>
            </div>

            <Separator />

            {/* Row Dimensions */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">
                  Row Dimensions
                </label>
                <Hint label="Add row dimension">
                  <Button variant="ghost" size="icon-xs" onClick={addRowDim} disabled={rowDims.length >= 3}>
                    <Plus />
                  </Button>
                </Hint>
              </div>
              <div className="space-y-2">
                {rowDims.map((rd, i) => (
                  <DimensionSelector
                    key={i}
                    dimension={rd.dimension}
                    level={rd.level}
                    onDimensionChange={(v) => updateRowDim(i, 'dimension', v)}
                    onLevelChange={(v) => updateRowDim(i, 'level', v)}
                    onRemove={() => removeRowDim(i)}
                    showRemove={rowDims.length > 1}
                  />
                ))}
              </div>
            </div>

            {/* Column Dimension */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">
                  Column Dimension
                </label>
                {colDim && (
                  <Hint label="Remove column dimension">
                    <Button variant="ghost" size="icon-xs" onClick={() => setColDim(null)}>
                      <X />
                    </Button>
                  </Hint>
                )}
              </div>
              {colDim ? (
                <DimensionSelector
                  dimension={colDim.dimension}
                  level={colDim.level}
                  onDimensionChange={(v) => setColDim({ ...colDim, dimension: v })}
                  onLevelChange={(v) => setColDim({ ...colDim, level: v })}
                  showRemove={false}
                />
              ) : (
                <Button variant="secondary" size="sm" className="w-full" onClick={() => setColDim({ dimension: 'date', level: 'month' })}>
                  <Plus />
                  Add column
                </Button>
              )}
            </div>

            <Separator />

            {/* Measure */}
            <div>
              <label className="mb-2 block text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">
                Measure
              </label>
              <Select value={measureKey} onValueChange={setMeasureKey}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEASURES.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-fg-muted">{measure.description}</p>
            </div>

            <Separator />

            {/* Slices */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">
                  Slices / Dice Filters
                </label>
                <div className="flex items-center gap-1">
                  {slices.length > 0 && (
                    <Hint label="Clear all filters">
                      <Button variant="ghost" size="icon-xs" onClick={clearSlices}>
                        <RotateCcw />
                      </Button>
                    </Hint>
                  )}
                  <Hint label="Add slice filter">
                    <Button variant="ghost" size="icon-xs" onClick={addSlice} disabled={slices.length >= 3}>
                      <Plus />
                    </Button>
                  </Hint>
                </div>
              </div>
              {slices.length === 0 ? (
                <p className="text-xs text-fg-muted">No slice filters. Add one to focus the cube.</p>
              ) : (
                <div className="space-y-2">
                  {slices.map((slice, i) => (
                    <SliceFilter
                      key={i}
                      slice={slice}
                      filters={filters}
                      otherSlices={slices.filter((_, j) => j !== i)}
                      onChange={(field, value) => updateSlice(i, field, value)}
                      onRemove={() => removeSlice(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          </PanelBody>
        </Panel>

        {/* Results Panel */}
        <Panel className="xl:col-span-3">
          <PanelHeader
            title="Results"
            icon={<Play />}
            actions={
              <Badge variant="neutral" size="sm">
                {result.scannedOrders.toLocaleString()} orders scanned
              </Badge>
            }
          />
          <PanelBody className="space-y-5">
            {/* Empty State */}
            {!hasData && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Info className="mb-3 size-10 text-fg-subtle" />
                <h3 className="text-sm font-semibold text-fg">No data in current selection</h3>
                <p className="mt-1 max-w-sm text-xs text-fg-muted">
                  Adjust the date range or remove filters to see results.
                </p>
              </div>
            )}

            {hasData && (
              <>
                {/* KPI Cards */}
                <div className="grid gap-3 sm:grid-cols-3">
                  {kpiData.map((kpi) => (
                    <div key={kpi.label} className="rounded-md border border-line bg-surface-sunken p-3">
                      <p className="text-2xs font-semibold uppercase tracking-[0.09em] text-fg-subtle">{kpi.label}</p>
                      <p className="mt-1 text-lg font-semibold text-fg">
                        {formatValue(kpi.value, kpi.format as any)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                {chartData.length > 0 && result.colMembers.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-fg">Visualization</h3>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {shouldUseLineChart ? (
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--grid))" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => formatValue(v, measure.format)} />
                            <Tooltip
                              formatter={(v: any) => [formatValue(v ?? 0, measure.format), measure.label]}
                              contentStyle={{
                                backgroundColor: 'rgb(var(--surface-raised))',
                                border: '1px solid rgb(var(--line))',
                                borderRadius: '6px',
                                fontSize: '12px',
                              }}
                            />
                            {result.colMembers.map((col, i) => (
                              <Line key={col} type="monotone" dataKey={col} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={{ r: 3 }} />
                            ))}
                          </LineChart>
                        ) : (
                          <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--grid))" />
                            <XAxis type="number" tickFormatter={(v) => formatValue(v, measure.format)} />
                            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                            <Tooltip
                              formatter={(v: any) => [formatValue(v ?? 0, measure.format), measure.label]}
                              contentStyle={{
                                backgroundColor: 'rgb(var(--surface-raised))',
                                border: '1px solid rgb(var(--line))',
                                borderRadius: '6px',
                                fontSize: '12px',
                              }}
                            />
                            {result.colMembers.map((col, i) => (
                              <Bar key={col} dataKey={col} fill={SERIES[i % SERIES.length]} />
                            ))}
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Result Table */}
                {hasResults ? (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-fg">Result Grid</h3>
                  {result.rowPath.length > 0 && (
                    <div className="flex items-center gap-1 text-2xs text-fg-subtle">
                      {result.rowPath.map((rp, i) => (
                        <span key={i}>
                          {rp.label}
                          {i < result.rowPath.length - 1 && <span className="mx-1 text-line">›</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <TableWrap>
                  <THead>
                    <TR>
                      <TH>
                        {rowDims.map((rd, i) => {
                          const dim = getDimension(rd.dimension)
                          const level = getLevel(rd.dimension, rd.level)
                          return (
                            <span key={i} className="mr-2">
                              {level?.label || dim?.label}
                            </span>
                          )
                        })}
                      </TH>
                      {result.colMembers.map((col) => (
                        <TH key={col} align="right">
                          {col}
                        </TH>
                      ))}
                      <TH align="right">Total</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {result.rows.map((row) => (
                      <OlapRow
                        key={row.id}
                        node={row}
                        colMembers={result.colMembers}
                        measure={measure}
                        expanded={expanded}
                        onToggleExpand={toggleExpand}
                        depth={0}
                      />
                    ))}
                    <TR className="border-t border-line-strong bg-surface-sunken/50">
                      <TD className="text-xs font-semibold text-fg">Grand Total</TD>
                      {result.grandTotal.map((v, i) => (
                        <TD key={i} align="right" className="text-xs font-semibold text-fg">
                          {formatValue(v, measure.format)}
                        </TD>
                      ))}
                      <TD align="right" className="text-xs font-semibold text-fg">
                        {formatValue(result.grandTotalValue, measure.format)}
                      </TD>
                    </TR>
                  </TBody>
                </TableWrap>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="mb-2 size-8 text-fg-subtle" />
                <p className="text-sm text-fg-muted">No results for current configuration</p>
                <p className="mt-1 text-xs text-fg-subtle">Try adjusting dimensions or filters</p>
              </div>
            )}
              </>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  )
}

function DimensionSelector({
  dimension,
  level,
  onDimensionChange,
  onLevelChange,
  onRemove,
  showRemove,
}: {
  dimension: string
  level: string
  onDimensionChange: (value: string) => void
  onLevelChange: (value: string) => void
  onRemove?: () => void
  showRemove: boolean
}) {
  const dim = getDimension(dimension)
  const levels = dim?.levels ?? []

  return (
    <div className="flex items-center gap-2">
      <Select value={dimension} onValueChange={onDimensionChange}>
        <SelectTrigger size="sm" className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DIMENSION_GROUPS.map((group) => (
            <SelectGroup key={group}>
              <SelectLabel>{group}</SelectLabel>
              {DIMENSIONS.filter((d) => d.group === group).map((d) => (
                <SelectItem key={d.key} value={d.key}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <Select value={level} onValueChange={onLevelChange}>
        <SelectTrigger size="sm" className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {levels.map((l) => (
            <SelectItem key={l.key} value={l.key}>
              {l.short}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showRemove && onRemove && (
        <Hint label="Remove dimension">
          <Button variant="ghost" size="icon-xs" onClick={onRemove}>
            <X />
          </Button>
        </Hint>
      )}
    </div>
  )
}

function SliceFilter({
  slice,
  filters,
  otherSlices,
  onChange,
  onRemove,
}: {
  slice: Slice
  filters: any
  otherSlices: Slice[]
  onChange: (field: keyof Slice, value: string | string[]) => void
  onRemove: () => void
}) {
  const dim = getDimension(slice.dimension)
  const levels = dim?.levels ?? []
  const availableMembers = membersOf(slice.dimension, slice.level, filters, otherSlices)

  return (
    <div className="rounded-md border border-line bg-surface-sunken p-2">
      <div className="mb-2 flex items-center gap-2">
        <Select value={slice.dimension} onValueChange={(v) => onChange('dimension', v)}>
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIMENSIONS.map((d) => (
              <SelectItem key={d.key} value={d.key}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={slice.level} onValueChange={(v) => onChange('level', v)}>
          <SelectTrigger size="sm" className="w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {levels.map((l) => (
              <SelectItem key={l.key} value={l.key}>
                {l.short}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Hint label="Remove filter">
          <Button variant="ghost" size="icon-xs" onClick={onRemove}>
            <Trash2 />
          </Button>
        </Hint>
      </div>
      <div className="scrollbar-thin max-h-[120px] overflow-y-auto">
        {availableMembers.length === 0 ? (
          <p className="px-2 py-2 text-xs text-fg-muted">No members available</p>
        ) : (
          availableMembers.map((member) => (
            <label key={member} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-xs hover:bg-surface-hover">
              <input
                type="checkbox"
                checked={slice.values.includes(member)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...slice.values, member]
                    : slice.values.filter((v) => v !== member)
                  onChange('values', next)
                }}
                className="size-3.5 rounded border-line"
              />
              <span className="truncate text-fg-secondary">{member}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

function OlapRow({
  node,
  colMembers,
  measure,
  expanded,
  onToggleExpand,
  depth,
}: {
  node: NonNullable<OlapResult['rows']>[number]
  colMembers: string[]
  measure: Measure
  expanded: string[]
  onToggleExpand: (id: string) => void
  depth: number
}) {
  const isExpanded = expanded.includes(node.id)
  const hasChildren = node.children.length > 0

  return (
    <>
      <tr className={cn('row-hover border-b border-line-soft', depth > 0 && 'bg-surface-sunken/30')}>
        <td className="px-3 py-2 text-xs" style={{ paddingLeft: `${12 + depth * 16}px` }}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggleExpand(node.id)}
                className="shrink-0 text-fg-subtle transition-colors hover:text-fg"
              >
                {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              </button>
            ) : (
              <span className="inline-block w-[14px]" />
            )}
            <span className={cn(depth > 0 && 'text-fg-muted')}>{node.label}</span>
          </div>
        </td>
        {colMembers.map((_, i) => (
          <td key={i} className="px-3 py-2 text-right text-xs text-fg-secondary">
            {formatValue(node.values[i] ?? 0, measure.format)}
          </td>
        ))}
        <td className="px-3 py-2 text-right text-xs font-medium text-fg">
          {formatValue(node.total, measure.format)}
        </td>
      </tr>
      {isExpanded &&
        node.children.map((child) => (
          <OlapRow
            key={child.id}
            node={child}
            colMembers={colMembers}
            measure={measure}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            depth={depth + 1}
          />
        ))}
    </>
  )
}

function formatValue(value: number, format: Measure['format']): string {
  switch (format) {
    case 'number':
      return formatNumber(value)
    case 'compact':
      return formatCompact(value)
    case 'currency':
      return formatCurrency(value)
    case 'compactCurrency':
      return formatCompactCurrency(value)
    case 'percent':
      return formatPercent(value)
    case 'days':
      return formatDays(value)
    case 'km':
      return formatKm(value)
    case 'kg':
      return `${formatCompact(value)} kg`
    case 'rating':
      return formatRatio(value, 2)
    default:
      return String(value)
  }
}
