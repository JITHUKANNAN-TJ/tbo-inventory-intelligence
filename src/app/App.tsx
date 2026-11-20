import { Suspense, lazy, useEffect } from 'react'
import { useRoute, navigate } from './router'
import { Layout } from './Layout'
import { ErrorBoundary } from '../components/ErrorBoundary'

const OverviewPage = lazy(() => import('../pages/Overview').then((m) => ({ default: m.OverviewPage })))
const OpportunitiesPage = lazy(() => import('../pages/Opportunities').then((m) => ({ default: m.OpportunitiesPage })))
const OpportunityDetailPage = lazy(() => import('../pages/OpportunityDetail').then((m) => ({ default: m.OpportunityDetailPage })))
const BudgetOptimizerPage = lazy(() => import('../pages/BudgetOptimizer').then((m) => ({ default: m.BudgetOptimizerPage })))
const RecommendationsPage = lazy(() => import('../pages/Recommendations').then((m) => ({ default: m.RecommendationsPage })))
const SuppliersPage = lazy(() => import('../pages/Suppliers').then((m) => ({ default: m.SuppliersPage })))
const SupplierDetailPage = lazy(() => import('../pages/Suppliers').then((m) => ({ default: m.SupplierDetailPage })))
const SettingsPage = lazy(() => import('../pages/Settings').then((m) => ({ default: m.SettingsPage })))

function PageFallback() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-1/3 rounded-lg bg-canvas" />
      <div className="h-4 w-2/3 rounded bg-canvas" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-canvas" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-canvas" />
    </div>
  )
}

export function App() {
  const route = useRoute()

  useEffect(() => {
    document.title =
      route.path === 'opportunities' && route.param
        ? 'Opportunity · TBO Inventory Intelligence'
        : `${route.path.charAt(0).toUpperCase()}${route.path.slice(1)} · TBO Inventory Intelligence`
  }, [route.path, route.param])

  let page: React.ReactNode
  switch (route.path) {
    case 'overview':
      page = <OverviewPage />
      break
    case 'opportunities':
      page = route.param ? <OpportunityDetailPage id={route.param} /> : <OpportunitiesPage />
      break
    case 'optimizer':
      page = <BudgetOptimizerPage />
      break
    case 'recommendations':
      page = <RecommendationsPage />
      break
    case 'suppliers':
      page = route.param ? <SupplierDetailPage id={route.param} /> : <SuppliersPage />
      break
    case 'settings':
      page = <SettingsPage />
      break
    default:
      page = <NotFoundPage />
  }

  return (
    <Layout route={route.path}>
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>{page}</Suspense>
      </ErrorBoundary>
    </Layout>
  )
}

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-soft">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-ink-muted">The page you requested does not exist or has moved.</p>
      <button
        type="button"
        onClick={() => navigate('/overview')}
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
      >
        Back to overview
      </button>
    </div>
  )
}

export function NotFoundRedirect() {
  useEffect(() => {
    navigate('/overview')
  }, [])
  return null
}