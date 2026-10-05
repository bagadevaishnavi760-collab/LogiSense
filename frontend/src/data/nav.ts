import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Boxes,
  Cpu,
  Database,
  LayoutDashboard,
  LineChart,
  Package,
  Settings,
  ShieldCheck,
  Truck,
} from 'lucide-react'

export interface NavEntry {
  to: string
  label: string
  icon: LucideIcon
  description: string
  keywords?: string[]
}

export interface NavSection {
  label: string
  entries: NavEntry[]
}

export const NAV: NavSection[] = [
  {
    label: 'Monitor',
    entries: [
      {
        to: '/',
        label: 'Overview',
        icon: LayoutDashboard,
        description: 'Executive delivery performance across the whole network',
        keywords: ['dashboard', 'kpi', 'home', 'summary'],
      },
      {
        to: '/delivery-analytics',
        label: 'Delivery Analytics',
        icon: LineChart,
        description: 'Trend, delay distribution and warehouse performance',
        keywords: ['transit', 'delay', 'otd', 'trend'],
      },
      {
        to: '/carrier-analytics',
        label: 'Carrier Analytics',
        icon: Truck,
        description: 'Carrier ranking, cost and service-level comparison',
        keywords: ['vendor', 'supplier', 'cost', 'sla'],
      },
    ],
  },
  {
    label: 'Warehouse',
    entries: [
      {
        to: '/olap',
        label: 'OLAP Explorer',
        icon: Boxes,
        description: 'Slice, dice, roll-up and drill-down the delivery cube',
        keywords: ['cube', 'pivot', 'mdx', 'rollup', 'drill', 'slice', 'dice'],
      },
      {
        to: '/orders',
        label: 'Orders',
        icon: Package,
        description: 'Search and inspect every delivery in the fact table',
        keywords: ['records', 'table', 'search', 'detail'],
      },
      {
        to: '/data-quality',
        label: 'Data Quality',
        icon: ShieldCheck,
        description: 'Completeness, duplicates, anomalies and column health',
        keywords: ['dq', 'missing', 'duplicates', 'validation', 'freshness'],
      },
    ],
  },
  {
    label: 'Intelligence',
    entries: [
      {
        to: '/risk-prediction',
        label: 'Risk Prediction',
        icon: Cpu,
        description: 'Score a shipment against the deployed late-risk model',
        keywords: ['ml', 'model', 'score', 'classifier', 'inference'],
      },
      {
        to: '/model-monitoring',
        label: 'Model Monitoring',
        icon: Activity,
        description: 'Classification metrics, drift and prediction volume',
        keywords: ['f1', 'roc', 'auc', 'drift', 'psi', 'metrics'],
      },
    ],
  },
  {
    label: 'System',
    entries: [
      {
        to: '/admin',
        label: 'Administration',
        icon: Database,
        description: 'Service health, ETL runs, warehouse and model registry',
        keywords: ['system', 'etl', 'api', 'warehouse', 'status', 'ops'],
      },
      {
        to: '/settings',
        label: 'Settings',
        icon: Settings,
        description: 'Appearance, notifications, account and data preferences',
        keywords: ['theme', 'dark', 'profile', 'preferences'],
      },
    ],
  },
]

export const NAV_FLAT: NavEntry[] = NAV.flatMap((section) => section.entries)

export function navFor(pathname: string): NavEntry | undefined {
  return NAV_FLAT.find((entry) => entry.to === pathname)
}
