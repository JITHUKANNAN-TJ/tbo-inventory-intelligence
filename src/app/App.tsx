import { useEffect } from 'react'
import { useRoute, navigate } from './router'
import { Layout } from './Layout'
import { OverviewPage } from '../pages/Overview'
import { OpportunitiesPage } from '../pages/Opportunities'
import { OpportunityDetailPage } from '../pages/OpportunityDetail'
import { BudgetOptimizerPage } from '../pages/BudgetOptimizer'
import { RecommendationsPage } from '../pages/Recommendations'
import { SuppliersPage, SupplierDetailPage } from '../pages/Suppliers'
import { SettingsPage } from '../pages/Settings'

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
      page = <OverviewPage />
  }

  return <Layout route={route.path}>{page}</Layout>
}

export function NotFoundRedirect() {
  useEffect(() => {
    navigate('/overview')
  }, [])
  return null
}
