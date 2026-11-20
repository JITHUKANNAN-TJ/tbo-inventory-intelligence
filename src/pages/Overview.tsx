import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Landmark, PieChart, Wallet } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { CATEGORIES, CATEGORY_MAP } from '../data/categories'
import type { CategoryId } from '../types'
import { categoryMix, demandSeries, portfolioSummary } from '../lib/analytics'
import { formatWeekRange } from '../lib/date'
import { navigate } from '../app/router'
import { ActionBadge, AnimatedNumber, Button, Card, CardHeader, PageHeader, PriorityBadge, StatCard, TableWrap, Td, Term, Th } from '../components/ui'
import { ChartLegend, DemandChart } from '../components/charts'

export function OverviewPage() {
  const { dataset, opportunities, plan, optimizer, recommendations, fmt, destName, opportunityLabel } = useApp()
  const [category, setCategory] = useState<'all' | CategoryId>('all')

  const activeCategories = category === 'all' ? plan.categories : plan.categories.filter((id) => id === category)
  const chartData = useMemo(
    () => demandSeries(dataset.history, opportunities, activeCategories),
    [dataset.history, opportunities, activeCategories],
  )
  const summary = useMemo(() => portfolioSummary(opportunities, plan), [opportunities, plan])
  const mix = useMemo(() => categoryMix(dataset.history), [dataset.history])

  const approved = recommendations.filter((rec) => rec.status === 'Approved')
  const approvedSpend = approved.reduce((sum, rec) => sum + rec.totalCost, 0)
  const atRisk = approved.reduce((sum, rec) => sum + rec.downsideExposure, 0)
  const atRiskPct = approvedSpend > 0 ? atRisk / approvedSpend : 0

  const priority = useMemo(
    () =>
      opportunities
        .filter(
          (opportunity) =>
            plan.categories.includes(opportunity.category) &&
            opportunity.weeksOut <= plan.horizonWeeks &&
            opportunity.action !== 'Monitor' &&
            opportunity.action !== 'Avoid',
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    [opportunities, plan],
  )

  const recent = useMemo(() => {
    // Show one representative line per product first so the overview reflects the
    // breadth of the portfolio, then fill any remaining slots by contribution.
    const ranked = [...recommendations].sort((a, b) => b.expectedContribution - a.expectedContribution)
    const categoryOf = (recId: string) => opportunities.find((item) => item.id === recId)?.category ?? 'other'
    const picked: typeof ranked = []
    const seen = new Set<string>()
    for (const rec of ranked) {
      if (picked.length >= 6) break
      const category = categoryOf(rec.opportunityId)
      if (seen.has(category)) continue
      seen.add(category)
      picked.push(rec)
    }
    for (const rec of ranked) {
      if (picked.length >= 6) break
      if (!picked.includes(rec)) picked.push(rec)
    }
    return picked
  }, [recommendations, opportunities])

  return (
    <div>
      <PageHeader
        eyebrow="Demand & availability"
        title="Inventory planning"
        description="A clear view of demand, availability and procurement decisions for the planning horizon."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/opportunities')}>
              Browse opportunities
            </Button>
            <Button variant="primary" onClick={() => navigate('/optimizer')}>
              Open budget optimizer
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Planning budget"
          value={<AnimatedNumber value={plan.budget} format={fmt} />}
          hint={`${plan.risk} · ${plan.horizonWeeks}-week horizon`}
          icon={<Wallet className="h-3.5 w-3.5" />}
          tone="brand"
          delay={60}
        />
        <StatCard
          label="Allocated"
          value={<AnimatedNumber value={optimizer.allocated} format={fmt} />}
          hint={`${(optimizer.fillRate * 100).toFixed(0)}% of spendable budget`}
          icon={<PieChart className="h-3.5 w-3.5" />}
          tone="success"
          delay={120}
        />
        <StatCard
          label="Remaining budget"
          value={<AnimatedNumber value={plan.budget - optimizer.allocated} format={fmt} />}
          hint={`${fmt(optimizer.reserve)} reserve · ${fmt(optimizer.accessBudget)} access pool`}
          icon={<Landmark className="h-3.5 w-3.5" />}
          delay={180}
        />
        <StatCard
          label="Expected downside"
          value={<AnimatedNumber value={atRisk} format={fmt} />}
          hint={`${atRiskPct > 0 ? `${(atRiskPct * 100).toFixed(1)}% of approved spend · ` : ''}${approved.length} approvals`}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          tone="warning"
          delay={240}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Weekly demand"
            description="Actual and forecast bookings in inventory units · shaded band shows the expected range"
            action={
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as 'all' | CategoryId)}
                className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-ink focus:border-brand focus:outline-none"
                aria-label="Filter chart by product category"
              >
                <option value="all">All products</option>
                {CATEGORIES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            }
          />
          <div className="px-3 pb-1 pt-4">
            <DemandChart data={chartData} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
            <ChartLegend />
            <p className="text-2xs text-ink-muted">
              Next {plan.horizonWeeks} weeks: {summary.forecast.toLocaleString('en-IN')} units forecast ·{' '}
              <span className="font-medium text-ink">{((summary.gapRatio || 0) * 100).toFixed(0)}% gap</span>
            </p>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            title="Priority opportunities"
            description="Ranked by demand gap, growth, margin and risk"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/opportunities')}>
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            }
          />
          <div className="flex-1 divide-y divide-line">
            {priority.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-ink-muted">No opportunities match the current plan filters.</p>
            ) : (
              priority.map((opportunity, index) => (
                <button
                  key={opportunity.id}
                  type="button"
                  onClick={() => navigate(`/opportunities/${opportunity.id}`)}
                  className="animate-fade-up flex w-full items-start justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-canvas/70"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {destName(opportunity.destinationId)} · {CATEGORY_MAP[opportunity.category].short}
                    </p>
                    <p className="mt-0.5 text-2xs text-ink-muted">{formatWeekRange(opportunity.weekStart)}</p>
                    <p className="mt-1 text-2xs text-ink-muted">
                      Gap <span className="font-medium text-ink">{Math.round(opportunity.gap).toLocaleString('en-IN')}</span>{' '}
                      {CATEGORY_MAP[opportunity.category].unit}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-ink">{opportunity.score.toFixed(1)}</span>
                    <PriorityBadge priority={opportunity.priority} />
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-line px-5 py-3 text-2xs text-ink-muted">
            {summary.highPriority} high-priority segments across {mix.length} product categories.
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Pre-buy plan"
          description="Recommended inventory to commit ahead of demand, with quantities and timing"
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/optimizer')}>
              Adjust budget
            </Button>
          }
        />
        <TableWrap>
          <thead>
            <tr>
              <Th>Destination · product</Th>
              <Th>Suggested action</Th>
              <Th align="right">Quantity</Th>
              <Th align="right">Committed spend</Th>
              <Th align="right">Buy by</Th>
              <Th align="right">Expected contribution</Th>
            </tr>
          </thead>
          <tbody>
            {recommendations
              .filter((rec) => rec.kind === 'commitment')
              .sort((a, b) => b.expectedContribution - a.expectedContribution)
              .slice(0, 6)
              .map((rec, index) => {
                const opportunity = opportunities.find((item) => item.id === rec.opportunityId)
                const supplier = dataset.suppliers.find((item) => item.id === rec.supplierId)
                const buyBy = opportunity
                  ? new Date(new Date(`${opportunity.weekStart}T00:00:00Z`).getTime() - 24 * 86400000).toISOString().slice(0, 10)
                  : '—'
                return (
                  <tr key={rec.id} className="data-row">
                    <Td>
                      <span className="font-medium text-ink">{opportunity ? opportunityLabel(opportunity) : rec.id}</span>
                      <span className="block text-2xs text-ink-muted">{supplier?.name ?? rec.supplierId}</span>
                    </Td>
                    <Td>
                      <ActionBadge action={rec.action} />
                    </Td>
                    <Td align="right">{rec.quantity.toLocaleString('en-IN')}</Td>
                    <Td align="right">{fmt(rec.totalCost)}</Td>
                    <Td align="right">{buyBy}</Td>
                    <Td align="right">{fmt(rec.expectedContribution)}</Td>
                  </tr>
                )
              })}
            {recommendations.filter((rec) => rec.kind === 'commitment').length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-ink-muted">
                  Run the optimizer to generate a pre-buy plan.
                </td>
              </tr>
            ) : null}
          </tbody>
        </TableWrap>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Recent recommendations"
          description="Decision support only — every commitment needs a recorded human approval."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/recommendations')}>
              Open review
            </Button>
          }
        />
        <TableWrap>
          <thead>
            <tr>
              <Th>Opportunity</Th>
              <Th>Suggested action</Th>
              <Th align="right">Committed spend</Th>
              <Th align="right">
                <Term definition="Expected revenue less supplier cost and variable expenses for the recommended quantity.">
                  Expected contribution
                </Term>
              </Th>
              <Th>Status</Th>
              <Th align="right">Travel week</Th>
            </tr>
          </thead>
          <tbody>
            {recent.map((rec, index) => {
              const opportunity = opportunities.find((item) => item.id === rec.opportunityId)
              return (
                <tr
                  key={rec.id}
                  className="animate-fade-up data-row group cursor-pointer hover:bg-canvas/60"
                  style={{ animationDelay: `${index * 45}ms` }}
                  onClick={() => navigate(`/opportunities/${rec.opportunityId}`)}
                >
                  <Td>
                    <span className="font-medium text-ink">{opportunity ? opportunityLabel(opportunity) : rec.id}</span>
                    <span className="block text-2xs text-ink-muted">{rec.kind === 'access' ? 'Live access decision' : `${rec.quantity.toLocaleString('en-IN')} units`}</span>
                  </Td>
                  <Td>
                    <ActionBadge action={rec.action} />
                  </Td>
                  <Td align="right">{rec.kind === 'access' ? '—' : fmt(rec.totalCost)}</Td>
                  <Td align="right">{rec.kind === 'access' ? '—' : fmt(rec.expectedContribution)}</Td>
                  <Td>
                    <span className="text-xs font-medium text-ink-muted">{rec.status}</span>
                  </Td>
                  <Td align="right">{opportunity ? formatWeekRange(opportunity.weekStart) : '—'}</Td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {mix.slice(0, 3).map((entry, index) => (
          <Card key={entry.category} className="surface-hover animate-fade-up px-4 py-3.5" style={{ animationDelay: `${index * 70}ms` }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink">{CATEGORY_MAP[entry.category].name}</p>
              <span className="text-2xs text-ink-muted">8-week view</span>
            </div>
            <p className="mt-1 text-lg font-semibold text-ink">{fmt(entry.revenue)}</p>
            <p className="text-2xs text-ink-muted">
              {entry.bookings.toLocaleString('en-IN')} bookings · look-to-book 1:{entry.ltb.toFixed(1)}
            </p>
          </Card>
        ))}
      </div>
    </div>
  )
}
