import {
  BarChart3,
  Boxes,
  BrainCircuit,
  ClipboardList,
  Database,
  Gauge,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const groups = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'OLAP Explorer', path: '/olap', icon: Database },
      { label: 'Delivery Analytics', path: '/delivery-analytics', icon: BarChart3 },
      { label: 'Carrier Analytics', path: '/carrier-analytics', icon: Truck },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Risk Prediction', path: '/risk-prediction', icon: BrainCircuit },
      { label: 'Delivery Forecast', path: '/delivery-forecast', icon: Gauge },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Orders', path: '/orders', icon: ClipboardList },
      { label: 'Data Quality', path: '/data-quality', icon: Boxes },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Model Monitoring', path: '/model-monitoring', icon: ShieldCheck },
      { label: 'Admin', path: '/admin', icon: Settings },
    ],
  },
]

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <strong>LogiSense</strong>
            <span>Logistics Intelligence</span>
          </div>
          <button className="mobile-close" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        <nav>
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>

              {group.items.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'active' : ''}`
                  }
                  end={path === '/'}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-dot" />
          <div>
            <strong>System online</strong>
            <span>Data services ready</span>
          </div>
        </div>
      </aside>
    </>
  )
}
