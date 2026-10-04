import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  DollarSign,
  Package,
  Star,
  Truck,
  AlertTriangle,
} from 'lucide-react'

const kpis = [
  { label: 'Total Orders', value: '50,000', change: '+8.4%', icon: Package, positive: true },
  { label: 'Order Value', value: '$12.84M', change: '+6.2%', icon: DollarSign, positive: true },
  { label: 'Shipping Spend', value: '$1.47M', change: '+3.1%', icon: Truck, positive: false },
  { label: 'Avg Delivery', value: '4.8 days', change: '-0.4 days', icon: Clock3, positive: true },
  { label: 'Late Rate', value: '34.1%', change: '-2.7%', icon: AlertTriangle, positive: true },
  { label: 'Avg Rating', value: '4.1 / 5', change: '+0.2', icon: Star, positive: true },
]

const carriers = [
  ['EagleCourier', 96],
  ['BlueRoute', 92],
  ['SpeedyCargo', 89],
  ['ParcelPro', 86],
  ['GlobalExpress', 82],
]

export function Overview() {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">EXECUTIVE OVERVIEW</p>
          <h1>Logistics Overview</h1>
          <p className="page-subtitle">
            Monitor delivery performance, operational efficiency, and network risk.
          </p>
        </div>

        <button className="date-button">Last 30 days ▾</button>
      </div>

      <section className="kpi-grid">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div className="kpi-card" key={kpi.label}>
              <div className="kpi-top">
                <div className="kpi-icon">
                  <Icon size={18} />
                </div>
                <span className={kpi.positive ? 'trend good' : 'trend'}>
                  {kpi.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {kpi.change}
                </span>
              </div>

              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-label">{kpi.label}</div>
            </div>
          )
        })}
      </section>

      <section className="dashboard-grid">
        <div className="panel panel-large">
          <div className="panel-heading">
            <div>
              <h2>Delivery Performance</h2>
              <p>Average delivery days across the reporting period</p>
            </div>
            <span className="panel-badge">Analytics</span>
          </div>

          <div className="chart-placeholder">
            <div className="chart-line">
              {[72, 61, 68, 48, 56, 43, 50, 36, 42, 31, 38, 27].map((height, i) => (
                <div className="chart-column" key={i}>
                  <div style={{ height: `${height}%` }} />
                </div>
              ))}
            </div>
            <div className="chart-axis">
              <span>May 01</span>
              <span>May 10</span>
              <span>May 20</span>
              <span>May 30</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Carrier Performance</h2>
              <p>On-time performance index</p>
            </div>
          </div>

          <div className="carrier-list">
            {carriers.map(([name, score]) => (
              <div className="carrier-row" key={name}>
                <div className="carrier-name">
                  <span>{name}</span>
                  <strong>{score}%</strong>
                </div>
                <div className="progress">
                  <div style={{ width: `${score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Delivery Status</h2>
              <p>Current order distribution</p>
            </div>
          </div>

          <div className="status-summary">
            <div className="status-number">65.9%</div>
            <div className="status-caption">On-time deliveries</div>

            <div className="status-bars">
              <div>
                <span><i className="dot green" /> On time</span>
                <b>65.9%</b>
              </div>
              <div>
                <span><i className="dot amber" /> Delayed</span>
                <b>24.7%</b>
              </div>
              <div>
                <span><i className="dot red" /> At risk</span>
                <b>9.4%</b>
              </div>
            </div>
          </div>
        </div>

        <div className="panel panel-large">
          <div className="panel-heading">
            <div>
              <h2>Network Snapshot</h2>
              <p>Operational intelligence from the delivery network</p>
            </div>
          </div>

          <div className="insight-grid">
            <div>
              <span>Active Carriers</span>
              <strong>8</strong>
              <small>Across the network</small>
            </div>
            <div>
              <span>Warehouses</span>
              <strong>12</strong>
              <small>Distribution locations</small>
            </div>
            <div>
              <span>Countries</span>
              <strong>18</strong>
              <small>Customer destinations</small>
            </div>
            <div>
              <span>Avg. Distance</span>
              <strong>842 km</strong>
              <small>Per delivery</small>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
