import "./App.css"
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { Overview } from './pages/Overview'

function Placeholder({ title }: { title: string }) {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">LOGISENSE</p>
          <h1>{title}</h1>
          <p className="page-subtitle">This module is ready for implementation.</p>
        </div>
      </div>

      <div className="placeholder-card">
        <div className="placeholder-icon">◈</div>
        <h2>{title}</h2>
        <p>
          The application shell is ready. This module will be connected to the
          LogiSense analytics backend in the next phases.
        </p>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/olap" element={<Placeholder title="OLAP Explorer" />} />
          <Route path="/delivery-analytics" element={<Placeholder title="Delivery Analytics" />} />
          <Route path="/carrier-analytics" element={<Placeholder title="Carrier Analytics" />} />
          <Route path="/risk-prediction" element={<Placeholder title="Risk Prediction" />} />
          <Route path="/delivery-forecast" element={<Placeholder title="Delivery Forecast" />} />
          <Route path="/orders" element={<Placeholder title="Orders" />} />
          <Route path="/data-quality" element={<Placeholder title="Data Quality" />} />
          <Route path="/model-monitoring" element={<Placeholder title="Model Monitoring" />} />
          <Route path="/admin" element={<Placeholder title="Administration" />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}

export default App
