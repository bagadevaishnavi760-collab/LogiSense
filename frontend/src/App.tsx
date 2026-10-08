import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout, NotFoundPage } from './layouts/AppLayout'
import { SkeletonChart, SkeletonStatGrid, SkeletonTable } from './components/ui/skeleton'
import { ErrorState } from './components/ui/states'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import CustomerPortal from './pages/CustomerPortal'
import Login from './pages/Login'
import { AuthProvider, useAuth } from './context/AuthContext'

/* Overview is the landing route, so it ships in the main bundle. */
import DashboardPage from './pages/Dashboard'

const OLAPPage = lazy(() => import('./pages/OLAPExplorer'))
const RiskPage = lazy(() => import('./pages/RiskPrediction'))
const CarrierPage = lazy(() => import('./pages/CarrierAnalytics'))
const DeliveryPage = lazy(() => import('./pages/DeliveryAnalytics'))
const ForecastPage = lazy(() => import('./pages/DeliveryForecast'))
const OrdersPage = lazy(() => import('./pages/OrdersExplorer'))
const QualityPage = lazy(() => import('./pages/DataQuality'))
const MonitoringPage = lazy(() => import('./pages/ModelMonitoring'))
const AdminPage = lazy(() => import('./pages/Admin'))
const SettingsPage = lazy(() => import('./pages/Settings'))

function RouteSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-6 w-72 animate-pulse rounded bg-surface-sunken" />
        <div className="h-3.5 w-[520px] max-w-full animate-pulse rounded bg-surface-sunken" />
      </div>
      <SkeletonStatGrid count={4} />
      <div className="grid gap-4 xl:grid-cols-3">
        <SkeletonChart className="xl:col-span-2" height={280} />
        <SkeletonChart height={280} />
      </div>
      <SkeletonTable rows={6} columns={6} />
    </div>
  )
}

function AuthLoading() {
  return <div className="flex min-h-dvh items-center justify-center bg-[#071329]"><span className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-white" /></div>
}

function ProtectedRoute({ role, children }: { role: 'ADMIN' | 'CUSTOMER'; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to={user.role === 'ADMIN' ? '/' : '/customer'} replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoading />
  return (
    <Routes>
      <Route path="login" element={user ? <Navigate to={user.role === 'ADMIN' ? '/' : '/customer'} replace /> : <Login />} />
      <Route element={<ProtectedRoute role="ADMIN"><AppLayout /></ProtectedRoute>}>
        <Route index element={<Suspense fallback={<RouteSkeleton />}><DashboardPage /></Suspense>} />
        <Route path="olap" element={<Suspense fallback={<RouteSkeleton />}><OLAPPage /></Suspense>} />
        <Route path="risk-prediction" element={<Suspense fallback={<RouteSkeleton />}><RiskPage /></Suspense>} />
        <Route path="carrier-analytics" element={<Suspense fallback={<RouteSkeleton />}><CarrierPage /></Suspense>} />
        <Route path="delivery-analytics" element={<Suspense fallback={<RouteSkeleton />}><DeliveryPage /></Suspense>} />
        <Route path="delivery-forecast" element={<Suspense fallback={<RouteSkeleton />}><ForecastPage /></Suspense>} />
        <Route path="orders" element={<Suspense fallback={<RouteSkeleton />}><OrdersPage /></Suspense>} />
        <Route path="data-quality" element={<Suspense fallback={<RouteSkeleton />}><QualityPage /></Suspense>} />
        <Route path="model-monitoring" element={<Suspense fallback={<RouteSkeleton />}><MonitoringPage /></Suspense>} />
        <Route path="admin" element={<Suspense fallback={<RouteSkeleton />}><AdminPage /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<RouteSkeleton />}><SettingsPage /></Suspense>} />
        <Route path="overview" element={<Navigate to="/" replace />} />
        <Route path="orders/explorer" element={<Navigate to="/orders" replace />} />
        <Route path="monitoring" element={<Navigate to="/model-monitoring" replace />} />
        <Route path="quality" element={<Navigate to="/data-quality" replace />} />
        <Route path="*" element={<Suspense fallback={<ErrorState title="Page unavailable" description="This view could not be loaded." />}><NotFoundPage /></Suspense>} />
      </Route>
      <Route path="customer/*" element={<ProtectedRoute role="CUSTOMER"><CustomerPortal /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? (user.role === 'ADMIN' ? '/' : '/customer') : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider><AppRoutes /></AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}