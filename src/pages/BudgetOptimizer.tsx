import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Gauge, Play, RefreshCw, ShieldCheck } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { CATEGORIES, CATEGORY_MAP, INR_PER_USD } from '../data/categories'
import { RISK_PRESETS } from '../lib/optimiser'
import type { CategoryId, Currency, RiskProfile } from '../types'
import { formatWeekRange } from '../lib/date'
import { navigate } from '../app/router'
import {
  ActionBadge,
  AnimatedNumber,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  ProgressBar,
  Segmented,
  StatCard,
  TableWrap,
  Td,
  Term,
  Th,
  inputClass,
  selectClass,
} from '../components/ui'

const RISK_DEFAULTS: Record<RiskProfile, { reservePct: number; supplierCapPct: number }> = {
  Conservative: { reservePct: 20, supplierCapPct: 12 },
  Balanced: { reservePct: 15, supplierCapPct: 20 },
  Growth: { reservePct: 8, supplierCapPct: 30 },
}

export function BudgetOptimizerPage() {
  const { plan, setPlan, optimizer, baseline, recommendations, opportunities, lastRunAt, runOptimisation, fmt, destName, supplierName } = useApp()
  const [budgetInput, setBudgetInput] = useState(() => String(Math.round(toDisplay(plan.budget, plan.currency))))

  useEffect(() => {
    setBudgetInput(String(Math.round(toDisplay(plan.budget, plan.currency))))
  }, [plan.budget, plan.currency])

  const commitPlan = () => {
    const parsed = Number(budgetInput.replace(/,/g, ''))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setBudgetInput(String(Math.round(toDisplay(plan.budget, plan.currency))))
      return
    }
    setPlan({ budget: Math.round(parsed * (plan.currency === 'INR' ? 1 : INR_PER_USD)) })
  }

  const maxCategory = useMemo(
    () => Math.max(1, ...optimizer.byCategory.map((entry) => entry.allocated)),
    [optimizer.byCategory],
  )

  const comparison = useMemo(() => {
    const keys = new Set<CategoryId>([
      ...optimizer.byCategory.map((entry) => entry.category),
      ...baseline.byCategory.map((entry) => entry.category),
    ])
    return [...keys].map((category) => ({
      category,
      previous: baseline.byCategory.find((entry) => entry.category === category)?.allocated ?? 0,
      proposed: optimizer.byCategory.find((entry) => entry.category === category)?.allocated ?? 0,
    }))
  }, [optimizer.byCategory, baseline.byCategory])

  const spendDelta = optimizer.allocated - baseline.allocated
  const topLines = optimizer.lines.slice(0, 10)
  const accessOpps = optimizer.access
    .map((item) => ({ item, opportunity: opportunities.find((o) => o.id === item.opportunityId) }))
    .filter((entry) => entry.opportunity)

  return (
    <div>
      <PageHeader
        eyebrow="Budget optimizer"
        title="Allocate a limited budget"
        description="Set the budget and constraints, then compare the proposed allocation with the current baseline. The optimizer recommends; it never purchases."
        actions={
          <>
            {lastRunAt ? <span className="text-2xs text-ink-muted">Last run {lastRunAt}</span> : null}
            <Button variant="primary" onClick={runOptimisation}>
              <Play className="h-3.5 w-3.5" /> Run optimization
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Plan inputs" description="Changes recalculate the allocation immediately" />
            <div className="space-y-4 px-4 py-4">
              <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-2">
                <Field label="Maximum budget" hint={plan.currency}>
                  <input
                    value={budgetInput}
                    onChange={(event) => setBudgetInput(event.target.value)}
                    onBlur={commitPlan}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitPlan()
                    }}
                    inputMode="numeric"
                    className={inputClass}
                  />
                </Field>
                <Field label="Currency">
                  <select
                    value={plan.currency}
                    onChange={(event) => setPlan({ currency: event.target.value as Currency })}
                    className={selectClass}
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: fmt(5000000), value: 5000000 },
                  { label: fmt(10000000), value: 10000000 },
                  { label: fmt(20000000), value: 20000000 },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setPlan({ budget: preset.value })}
                    className="rounded-full border border-line px-2.5 py-1 text-2xs text-ink-muted hover:border-brand/40 hover:text-ink"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <Field label="Risk preference" hint={RISK_PRESETS[plan.risk].note}>
                <Segmented
                  options={[
                    { value: 'Conservative', label: 'Conservative' },
                    { value: 'Balanced', label: 'Balanced' },
                    { value: 'Growth', label: 'Growth' },
                  ]}
                  value={plan.risk}
                  onChange={(value) =>
                    setPlan({
                      risk: value,
                      reservePct: RISK_DEFAULTS[value].reservePct,
                      supplierCapPct: RISK_DEFAULTS[value].supplierCapPct,
                    })
                  }
                />
              </Field>

              <Field label="Planning horizon">
                <select
                  value={plan.horizonWeeks}
                  onChange={(event) => setPlan({ horizonWeeks: Number(event.target.value) })}
                  className={selectClass}
                >
                  <option value={8}>Next 8 weeks</option>
                  <option value={12}>Next 12 weeks</option>
                  <option value={16}>Next 16 weeks</option>
                </select>
              </Field>

              <div>
                <p className="mb-1.5 text-xs font-medium text-ink">Product categories</p>
                <div className="space-y-1">
                  {CATEGORIES.map((category) => {
                    const checked = plan.categories.includes(category.id)
                    return (
                      <label
                        key={category.id}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs text-ink hover:bg-canvas"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...plan.categories, category.id]
                                : plan.categories.filter((id) => id !== category.id)
                              if (next.length === 0) return
                              setPlan({ categories: next })
                            }}
                            className="h-3.5 w-3.5 rounded border-line accent-brand"
                          />
                          {category.name}
                        </span>
                        <span className="text-2xs text-ink-muted">{category.decision === 'access' ? 'access' : category.unit}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <details className="group rounded-lg border border-line">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-ink">
                  Advanced constraints
                  <span className="ml-1 text-2xs font-normal text-ink-muted">reserve, supplier exposure, category caps</span>
                </summary>
                <div className="space-y-3 border-t border-line px-3 py-3">
                  <Field label="Cash reserve" hint={`${plan.reservePct}%`}>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={plan.reservePct}
                      onChange={(event) => setPlan({ reservePct: Number(event.target.value) })}
                      className="w-full accent-brand"
                    />
                  </Field>
                  <Field label="Max exposure per supplier" hint={`${plan.supplierCapPct}%`}>
                    <input
                      type="range"
                      min={5}
                      max={50}
                      step={1}
                      value={plan.supplierCapPct}
                      onChange={(event) => setPlan({ supplierCapPct: Number(event.target.value) })}
                      className="w-full accent-brand"
                    />
                  </Field>
                  <div className="space-y-2">
                    <p className="text-2xs font-medium text-ink-muted">Category caps (% of budget, blank = no cap)</p>
                    {plan.categories.map((category) => (
                      <div key={category} className="flex items-center justify-between gap-2">
                        <span className="text-2xs text-ink">{CATEGORY_MAP[category].name}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={plan.categoryCaps[category] ?? ''}
                          onChange={(event) => {
                            const raw = event.target.value
                            const caps = { ...plan.categoryCaps }
                            if (raw === '') delete caps[category]
                            else caps[category] = Math.max(0, Math.min(100, Number(raw)))
                            setPlan({ categoryCaps: caps })
                          }}
                          placeholder="—"
                          className="h-7 w-14 rounded-md border border-line px-2 text-right text-2xs text-ink focus:border-brand focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </details>

              <Button variant="primary" className="w-full" onClick={runOptimisation}>
                <RefreshCw className="h-3.5 w-3.5" /> Run optimization
              </Button>
              <p className="text-2xs leading-relaxed text-ink-muted">
                Recommended action only. No supplier is contacted and no inventory is purchased.
              </p>
            </div>
          </Card>

          <Card className="px-4 py-3.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
              <Gauge className="h-3.5 w-3.5 text-ink-soft" /> How the plan is built
            </p>
            <p className="mt-1.5 text-2xs leading-relaxed text-ink-muted">
              Units are ranked by expected contribution per unit of spend. Demand is split into high-confidence, expected and speculative tranches;
              the risk profile chooses which tranches may be committed.
            </p>
            <p className="mt-2 rounded-md bg-canvas px-2.5 py-2 font-mono text-2xs text-ink-muted">
              EV = p × margin − (1 − p) × unsold loss
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Committed spend"
              value={<AnimatedNumber value={optimizer.allocated} format={fmt} />}
              hint={`${(optimizer.fillRate * 100).toFixed(0)}% of spendable budget`}
              tone="brand"
              delay={60}
              delta={
                spendDelta === 0
                  ? undefined
                  : {
                      label: `${spendDelta > 0 ? '+' : '−'}${fmt(Math.abs(spendDelta))}`,
                      tone: spendDelta > 0 ? 'success' : 'danger',
                    }
              }
            />
            <StatCard
              label="Expected contribution"
              value={<AnimatedNumber value={optimizer.expectedContribution} format={fmt} />}
              hint="Risk-adjusted, after supplier cost"
              tone="success"
              delay={120}
            />
            <StatCard
              label="Downside exposure"
              value={<AnimatedNumber value={optimizer.downside} format={fmt} />}
              hint="Unsold units at the release deadline"
              tone="warning"
              delay={180}
            />
            <StatCard
              label="Reserve & unallocated"
              value={<AnimatedNumber value={optimizer.reserve + optimizer.unallocated} format={fmt} />}
              hint={`Includes ${fmt(optimizer.accessBudget)} access pool`}
              delay={240}
            />
          </div>

          {optimizer.lines.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ShieldCheck className="h-6 w-6" />}
                title="No allocation under these constraints"
                description="Try increasing the budget, widening the horizon, adding product categories or choosing a higher risk profile."
              />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title="Proposed allocation by product"
                  description={`${optimizer.lines.length} supplier commitments across ${optimizer.byCategory.length} product categories`}
                  action={<Badge tone="brand">{fmt(optimizer.allocated)} committed</Badge>}
                />
                <div className="space-y-3 px-5 py-4">
                  {optimizer.byCategory
                    .sort((a, b) => b.allocated - a.allocated)
                    .map((entry, index) => (
                      <div key={entry.category} className="animate-fade-up" style={{ animationDelay: `${index * 60}ms` }}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium text-ink">{CATEGORY_MAP[entry.category].name}</span>
                          <span className="tabular-nums text-ink-muted">
                            {fmt(entry.allocated)} <span className="text-ink-soft">·</span>{' '}
                            <span className="text-ok">{fmt(entry.contribution)}</span>
                          </span>
                        </div>
                        <ProgressBar value={entry.allocated / maxCategory} tone="brand" />
                        <p className="mt-1 text-2xs text-ink-muted">
                          {entry.units.toLocaleString('en-IN')} {CATEGORY_MAP[entry.category].unit} · downside {fmt(entry.downside)}
                        </p>
                      </div>
                    ))}
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Top proposed purchases"
                  description="Highest expected contribution first · open a row to review the supporting evidence"
                  action={
                    <Button variant="ghost" size="sm" onClick={() => navigate('/recommendations')}>
                      Review all <ArrowRight className="h-3 w-3" />
                    </Button>
                  }
                />
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Opportunity</Th>
                      <Th>Travel week</Th>
                      <Th>Supplier</Th>
                      <Th align="right">Quantity</Th>
                      <Th align="right">Unit cost</Th>
                      <Th align="right">Spend</Th>
                      <Th align="right">
                        <Term definition="Expected revenue less supplier cost and variable expenses, weighted by tranche sell probability.">
                          Contribution
                        </Term>
                      </Th>
                      <Th>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLines.map((line, index) => {
                      const opportunity = opportunities.find((item) => item.id === line.opportunityId)
                      if (!opportunity) return null
                      const recommendation = recommendations.find(
                        (rec) => rec.opportunityId === line.opportunityId && rec.supplierId === line.supplierId,
                      )
                      return (
                        <tr
                          key={`${line.opportunityId}-${line.supplierId}`}
                          className="animate-fade-up data-row cursor-pointer hover:bg-canvas/60"
                          style={{ animationDelay: `${index * 35}ms` }}
                          onClick={() => navigate(`/opportunities/${line.opportunityId}`)}
                        >
                          <Td>
                            <span className="font-medium text-ink">{destName(opportunity.destinationId)}</span>
                            <span className="block text-2xs text-ink-muted">{CATEGORY_MAP[opportunity.category].short}</span>
                          </Td>
                          <Td>{formatWeekRange(opportunity.weekStart)}</Td>
                          <Td>{supplierName(line.supplierId)}</Td>
                          <Td align="right">{line.quantity.toLocaleString('en-IN')}</Td>
                          <Td align="right">{fmt(line.unitCost, false)}</Td>
                          <Td align="right">{fmt(line.totalCost)}</Td>
                          <Td align="right">
                            <span className="font-medium text-ok">{fmt(line.expectedContribution)}</span>
                          </Td>
                          <Td>
                            <ActionBadge action={recommendation?.action ?? opportunity.action} />
                          </Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </TableWrap>
              </Card>

              {accessOpps.length > 0 && plan.categories.includes('flight') ? (
                <Card>
                  <CardHeader
                    title="Access & connectivity plan"
                    description={`${fmt(optimizer.accessBudget)} planning allowance · flights remain live fare access decisions`}
                  />
                  <ul className="divide-y divide-line">
                    {accessOpps.map(({ item, opportunity }) => (
                      <li key={item.opportunityId} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-ink">
                            {destName(opportunity!.destinationId)} · {formatWeekRange(opportunity!.weekStart)}
                          </p>
                          <p className="mt-0.5 text-2xs text-ink-muted">
                            Gap {Math.round(opportunity!.gap).toLocaleString('en-IN')} seats · preferred supplier {supplierName(item.supplierId)}
                          </p>
                        </div>
                        <ActionBadge action={item.action} />
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              <Card>
                <CardHeader
                  title="Proposed plan vs baseline"
                  description="Committed spend by product category"
                />
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Category</Th>
                      <Th align="right">Baseline</Th>
                      <Th align="right">Proposed</Th>
                      <Th align="right">Change</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((row) => {
                      const delta = row.proposed - row.previous
                      return (
                        <tr key={row.category} className="data-row">
                          <Td>{CATEGORY_MAP[row.category].name}</Td>
                          <Td align="right">{fmt(row.previous)}</Td>
                          <Td align="right">{fmt(row.proposed)}</Td>
                          <Td align="right">
                            <span className={delta > 0 ? 'text-ok' : delta < 0 ? 'text-bad' : 'text-ink-muted'}>
                              {delta === 0 ? '—' : `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}`}
                            </span>
                          </Td>
                        </tr>
                      )
                    })}
                    <tr className="data-row bg-canvas/40">
                      <Td className="font-semibold">Total committed</Td>
                      <Td align="right" className="font-semibold">{fmt(baseline.allocated)}</Td>
                      <Td align="right" className="font-semibold">{fmt(optimizer.allocated)}</Td>
                      <Td align="right" className="font-semibold">
                        {optimizer.allocated === baseline.allocated
                          ? '—'
                          : `${optimizer.allocated > baseline.allocated ? '+' : '−'}${fmt(Math.abs(optimizer.allocated - baseline.allocated))}`}
                      </Td>
                    </tr>
                  </tbody>
                </TableWrap>
                <div className="px-5 py-3">
                  <Notice tone="info">
                    The optimizer never allocates more than the approved budget. Reserve, access allowance and supplier exposure caps are applied before
                    any commitment is proposed.
                  </Notice>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function toDisplay(value: number, currency: Currency): number {
  return currency === 'INR' ? value : value / INR_PER_USD
}
