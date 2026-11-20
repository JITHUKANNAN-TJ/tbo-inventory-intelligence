import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Building2, SearchX, Star } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { CATEGORIES, CATEGORY_MAP } from '../data/categories'
import type { CategoryId } from '../types'
import { formatWeekRange } from '../lib/date'
import { navigate } from '../app/router'
import { RateHistoryChart } from '../components/charts'
import {
  ActionBadge,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatCard,
  TableWrap,
  Td,
  Th,
  inputClass,
  selectClass,
} from '../components/ui'

export function SuppliersPage() {
  const { dataset, fmt } = useApp()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | CategoryId>('all')

  const suppliers = useMemo(() => {
    const search = query.trim().toLowerCase()
    return dataset.suppliers
      .filter((supplier) => {
        if (category !== 'all' && supplier.category !== category) return false
        if (search && !supplier.name.toLowerCase().includes(search)) return false
        return true
      })
      .sort((a, b) => b.reliability - a.reliability)
  }, [dataset.suppliers, query, category])

  const avgReliability = dataset.suppliers.reduce((sum, s) => sum + s.reliability, 0) / dataset.suppliers.length
  const fragile = dataset.suppliers.filter((supplier) => supplier.reliability < 0.87).length

  return (
    <div>
      <PageHeader
        eyebrow="Supplier integration"
        title="Supplier intelligence"
        description="Compare rate, reliability, flexibility and response time before choosing where to source inventory."
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Active suppliers" value={dataset.suppliers.length} hint={`${CATEGORIES.length} product categories`} icon={<Building2 className="h-3.5 w-3.5" />} tone="brand" delay={60} />
        <StatCard label="Average reliability" value={`${(avgReliability * 100).toFixed(1)}%`} hint="Weighted by confirmation history" icon={<Star className="h-3.5 w-3.5" />} tone="success" delay={120} />
        <StatCard label="Watch list" value={fragile} hint="Suppliers below 87% reliability" tone="warning" delay={180} />
        <StatCard
          label="Highest average rate"
          value={fmt(Math.max(...dataset.suppliers.map((supplier) => supplier.avgRate)))}
          hint="Premium category supplier"
          delay={240}
        />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-end gap-2 border-b border-line px-4 py-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="supplier-search" className="mb-1 block text-2xs font-medium text-ink-muted">
              Search supplier
            </label>
            <input
              id="supplier-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Supplier name"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="supplier-category" className="mb-1 block text-2xs font-medium text-ink-muted">
              Category
            </label>
            <select
              id="supplier-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as 'all' | CategoryId)}
              className={selectClass}
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {suppliers.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title="No suppliers match"
            description="Clear the search or choose a different product category."
            action={<Button onClick={() => { setQuery(''); setCategory('all') }}>Clear filters</Button>}
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Supplier</Th>
                <Th>Category</Th>
                <Th>Destinations</Th>
                <Th align="right">Average rate</Th>
                <Th>Reliability</Th>
                <Th align="right">Failure rate</Th>
                <Th>Flexibility</Th>
                <Th align="right">Response</Th>
                <Th>Last update</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier, index) => (
                <tr
                  key={supplier.id}
                  className="animate-fade-up data-row cursor-pointer hover:bg-canvas/60"
                  style={{ animationDelay: `${Math.min(index, 15) * 30}ms` }}
                  onClick={() => navigate(`/suppliers/${supplier.id}`)}
                >
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{supplier.name}</span>
                      {supplier.tier === 'Premium' ? <Badge tone="brand">Premium</Badge> : null}
                    </div>
                    <span className="text-2xs text-ink-muted">{supplier.tier} · {supplier.id}</span>
                  </Td>
                  <Td>{CATEGORY_MAP[supplier.category].name}</Td>
                  <Td>
                    {supplier.destinations.length}
                    <span className="block max-w-[180px] truncate text-2xs text-ink-muted">
                      {supplier.destinations.slice(0, 2).map((id) => dataset.destinations.find((d) => d.id === id)?.city ?? id).join(', ')}
                      {supplier.destinations.length > 2 ? '…' : ''}
                    </span>
                  </Td>
                  <Td align="right">{fmt(supplier.avgRate, false)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={supplier.reliability} tone={supplier.reliability > 0.92 ? 'success' : supplier.reliability > 0.87 ? 'brand' : 'warning'} className="w-16" />
                      <span className="text-2xs tabular-nums text-ink-muted">{(supplier.reliability * 100).toFixed(1)}%</span>
                    </div>
                  </Td>
                  <Td align="right">{(supplier.failureRate * 100).toFixed(1)}%</Td>
                  <Td>
                    <Badge tone={supplier.flexibility === 'high' ? 'success' : supplier.flexibility === 'medium' ? 'neutral' : 'warning'}>
                      {supplier.flexibility}
                    </Badge>
                  </Td>
                  <Td align="right">{supplier.responseHours}h</Td>
                  <Td>{supplier.lastUpdated.slice(0, 10)}</Td>
                  <Td align="right">
                    <Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); navigate(`/suppliers/${supplier.id}`) }}>
                      View <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <p className="mt-3 text-2xs leading-relaxed text-ink-muted">
        Confirm rates, availability and contract terms with the supplier before recording a commitment.
      </p>
    </div>
  )
}

export function SupplierDetailPage({ id }: { id?: string }) {
  const { dataset, opportunities, fmt, destName } = useApp()
  const supplier = dataset.suppliers.find((item) => item.id === id)

  if (!supplier) {
    return (
      <Card>
        <EmptyState
          title="Supplier not found"
          description="The supplier may not exist in the current dataset."
          action={<Button onClick={() => navigate('/suppliers')}>Back to suppliers</Button>}
        />
      </Card>
    )
  }

  const related = opportunities
    .filter(
      (opportunity) =>
        opportunity.quotes.some((quote) => quote.supplierId === supplier.id) &&
        opportunity.gap > 0 &&
        opportunity.action !== 'Monitor' &&
        opportunity.action !== 'Avoid',
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/suppliers')}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All suppliers
      </button>

      <PageHeader
        eyebrow={`${CATEGORY_MAP[supplier.category].name} supplier`}
        title={supplier.name}
        description={`${supplier.tier} supplier · ${supplier.destinations.length} destinations · data updated ${supplier.lastUpdated}`}
        actions={<Badge tone={supplier.reliability > 0.92 ? 'success' : 'warning'}>{(supplier.reliability * 100).toFixed(1)}% reliable</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Average rate" value={fmt(supplier.avgRate, false)} hint={`${CATEGORY_MAP[supplier.category].unitSingular} baseline`} delay={60} />
        <StatCard label="Confirmation reliability" value={`${(supplier.reliability * 100).toFixed(1)}%`} hint="Rolling supplier history" tone="success" delay={120} />
        <StatCard label="Failure / cancellation" value={`${(supplier.failureRate * 100).toFixed(1)}%`} hint="Lower is better" tone="warning" delay={180} />
        <StatCard label="Response time" value={`${supplier.responseHours}h`} hint={`${supplier.flexibility} contract flexibility`} delay={240} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Rate history" description="Average quoted rate over the last 12 months" />
          <div className="px-3 py-4">
            <RateHistoryChart data={supplier.rateHistory} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Performance profile" description="Rolling reliability, cancellation and response measures" />
          <div className="space-y-4 px-5 py-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-ink-muted">Reliability</span>
                <span className="font-medium text-ink">{(supplier.reliability * 100).toFixed(1)}%</span>
              </div>
              <ProgressBar value={supplier.reliability} tone="success" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-ink-muted">Failure rate</span>
                <span className="font-medium text-ink">{(supplier.failureRate * 100).toFixed(1)}%</span>
              </div>
              <ProgressBar value={supplier.failureRate} tone="danger" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-ink-muted">Response speed</span>
                <span className="font-medium text-ink">{supplier.responseHours}h</span>
              </div>
              <ProgressBar value={1 - Math.min(1, supplier.responseHours / 48)} tone="brand" />
            </div>
            <div className="rounded-lg bg-canvas px-3 py-2.5 text-2xs leading-relaxed text-ink-muted">
              Flexibility: <span className="font-medium text-ink">{supplier.flexibility}</span>. Lower flexibility means higher unsold exposure when
              demand falls short of forecast.
            </div>
            <div>
              <p className="mb-1.5 text-2xs font-medium text-ink-muted">Destinations covered</p>
              <div className="flex flex-wrap gap-1">
                {supplier.destinations.map((destinationId) => (
                  <Badge key={destinationId} tone="outline">
                    {destName(destinationId)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Related opportunities"
          description="Open gaps where this supplier is quoted"
          action={<Button variant="ghost" size="sm" onClick={() => navigate('/opportunities')}>All opportunities</Button>}
        />
        {related.length === 0 ? (
          <EmptyState title="No open opportunities" description="This supplier is not quoted on any current gap with an actionable recommendation." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Opportunity</Th>
                <Th>Travel week</Th>
                <Th align="right">Gap</Th>
                <Th align="right">Score</Th>
                <Th>Action</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {related.map((opportunity, index) => (
                <tr
                  key={opportunity.id}
                  className="animate-fade-up data-row cursor-pointer hover:bg-canvas/60"
                  style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
                  onClick={() => navigate(`/opportunities/${opportunity.id}`)}
                >
                  <Td>
                    <span className="font-medium text-ink">{destName(opportunity.destinationId)}</span>
                    <span className="block text-2xs text-ink-muted">{CATEGORY_MAP[opportunity.category].name}</span>
                  </Td>
                  <Td>{formatWeekRange(opportunity.weekStart)}</Td>
                  <Td align="right">{Math.round(opportunity.gap).toLocaleString('en-IN')}</Td>
                  <Td align="right">{opportunity.score.toFixed(1)}</Td>
                  <Td><ActionBadge action={opportunity.action} /></Td>
                  <Td align="right">
                    <Button variant="ghost" size="sm">View</Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  )
}
