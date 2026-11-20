import { useMemo, useState } from 'react'
import { ArrowUpRight, Download, SearchX } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { CATEGORIES, CATEGORY_MAP } from '../data/categories'
import type { ActionType, CategoryId, Priority } from '../types'
import { formatWeekRange } from '../lib/date'
import { buildOpportunitiesCsv, downloadFile } from '../lib/csv'
import { navigate } from '../app/router'
import {
  ActionBadge,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  PriorityBadge,
  TableWrap,
  Td,
  Th,
  inputClass,
  selectClass,
} from '../components/ui'

const PAGE_SIZE = 12

export function OpportunitiesPage() {
  const { opportunities, plan, dataset, decisions, fmt, destName } = useApp()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | CategoryId>('all')
  const [period, setPeriod] = useState<'all' | 'next4' | 'next8' | 'later'>('all')
  const [priority, setPriority] = useState<'all' | Priority>('all')
  const [action, setAction] = useState<'all' | ActionType>('all')
  const [sort, setSort] = useState<'score' | 'gap' | 'date'>('score')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    const rows = opportunities.filter((opportunity) => {
      if (opportunity.weeksOut > plan.horizonWeeks) return false
      if (category !== 'all' && opportunity.category !== category) return false
      if (priority !== 'all' && opportunity.priority !== priority) return false
      if (action !== 'all' && opportunity.action !== action) return false
      if (period === 'next4' && opportunity.weeksOut > 4) return false
      if (period === 'next8' && (opportunity.weeksOut <= 4 || opportunity.weeksOut > 8)) return false
      if (period === 'later' && opportunity.weeksOut <= 8) return false
      if (search) {
        const haystack = `${destName(opportunity.destinationId)} ${CATEGORY_MAP[opportunity.category].name} ${opportunity.id}`.toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })
    return rows.sort((a, b) => {
      if (sort === 'gap') return b.gap - a.gap
      if (sort === 'date') return a.weekStart.localeCompare(b.weekStart)
      return b.score - a.score
    })
  }, [opportunities, plan.horizonWeeks, category, priority, action, period, query, sort, destName])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const current = Math.min(page, Math.max(1, pageCount))
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const high = filtered.filter((row) => row.priority === 'High').length
  const totalGap = filtered.reduce((sum, row) => sum + row.gap, 0)

  const reset = () => {
    setQuery('')
    setCategory('all')
    setPeriod('all')
    setPriority('all')
    setAction('all')
    setSort('score')
    setPage(1)
  }

  const update = <T,>(setter: (value: T) => void, value: T) => {
    setter(value)
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Opportunities"
        title="Where availability may fall short"
        description="Forecast demand compared with reliable bookable supply. Open a row to review supplier options and record a decision."
        actions={
          <Button
            variant="secondary"
            onClick={() => downloadFile('tbo-opportunities.csv', buildOpportunitiesCsv(filtered, dataset.suppliers, dataset.destinations))}
          >
            <Download className="h-3.5 w-3.5" /> Export view
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-2xs text-ink-muted">
        <Badge tone="outline">{filtered.length.toLocaleString('en-IN')} opportunities</Badge>
        <Badge tone="danger">{high} high priority</Badge>
        <Badge tone="neutral">{Math.round(totalGap).toLocaleString('en-IN')} units of gap</Badge>
        <span className="ml-auto text-ink-soft">
          Sorted by {sort === 'score' ? 'opportunity score' : sort === 'gap' ? 'largest gap' : 'travel date'} · scores normalised by category
        </span>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-2 border-b border-line px-4 py-3">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-2xs font-medium text-ink-muted" htmlFor="opportunity-search">
              Search
            </label>
            <input
              id="opportunity-search"
              value={query}
              onChange={(event) => update(setQuery, event.target.value)}
              placeholder="Destination, product or opportunity ID"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-2xs font-medium text-ink-muted" htmlFor="filter-category">
              Product
            </label>
            <select id="filter-category" value={category} onChange={(event) => update(setCategory, event.target.value as 'all' | CategoryId)} className={selectClass}>
              <option value="all">All products</option>
              {CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-2xs font-medium text-ink-muted" htmlFor="filter-period">
              Travel period
            </label>
            <select id="filter-period" value={period} onChange={(event) => update(setPeriod, event.target.value as typeof period)} className={selectClass}>
              <option value="all">All weeks</option>
              <option value="next4">Next 4 weeks</option>
              <option value="next8">Weeks 5–8</option>
              <option value="later">Weeks 9+</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-2xs font-medium text-ink-muted" htmlFor="filter-priority">
              Priority
            </label>
            <select id="filter-priority" value={priority} onChange={(event) => update(setPriority, event.target.value as typeof priority)} className={selectClass}>
              <option value="all">All priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-2xs font-medium text-ink-muted" htmlFor="filter-action">
              Action
            </label>
            <select id="filter-action" value={action} onChange={(event) => update(setAction, event.target.value as typeof action)} className={selectClass}>
              <option value="all">All actions</option>
              <option value="Commit allotment">Commit allotment</option>
              <option value="Negotiate allotment">Negotiate allotment</option>
              <option value="Negotiate access">Negotiate access</option>
              <option value="Prioritise live supply">Prioritise live supply</option>
              <option value="Monitor">Monitor</option>
              <option value="Avoid">Avoid</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-2xs font-medium text-ink-muted" htmlFor="filter-sort">
              Sort
            </label>
            <select id="filter-sort" value={sort} onChange={(event) => update(setSort, event.target.value as typeof sort)} className={selectClass}>
              <option value="score">Opportunity score</option>
              <option value="gap">Estimated gap</option>
              <option value="date">Travel date</option>
            </select>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title="No opportunities match these filters"
            description="Try widening the travel period, clearing the product filter or searching for a different destination."
            action={<Button variant="secondary" onClick={reset}>Clear filters</Button>}
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Destination / product</Th>
                  <Th>Travel period</Th>
                  <Th align="right">Forecast demand</Th>
                  <Th align="right">Reliable availability</Th>
                  <Th align="right">Estimated gap</Th>
                  <Th align="right">Score</Th>
                  <Th>Action</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((opportunity, index) => {
                  const categoryMeta = CATEGORY_MAP[opportunity.category]
                  const decisionCount = Object.keys(decisions).filter((key) => key.includes(opportunity.id)).length
                  return (
                    <tr
                      key={opportunity.id}
                      className="animate-fade-up data-row cursor-pointer hover:bg-canvas/60"
                      style={{ animationDelay: `${Math.min(index, 15) * 35}ms` }}
                      onClick={() => navigate(`/opportunities/${opportunity.id}`)}
                    >
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{destName(opportunity.destinationId)}</span>
                          {opportunity.id.startsWith('imp-') ? <Badge tone="outline">Imported</Badge> : null}
                          {decisionCount > 0 ? <Badge tone="brand">Reviewing</Badge> : null}
                        </div>
                        <span className="text-2xs text-ink-muted">
                          {categoryMeta.name} · {categoryMeta.unit}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-ink">{formatWeekRange(opportunity.weekStart)}</span>
                        <span className="block text-2xs text-ink-muted">{opportunity.weeksOut === 1 ? 'Next week' : `In ${opportunity.weeksOut} weeks`}</span>
                      </Td>
                      <Td align="right">{opportunity.forecast.toLocaleString('en-IN')}</Td>
                      <Td align="right">{opportunity.reliableSupply.toLocaleString('en-IN')}</Td>
                      <Td align="right">
                        <span className={opportunity.gap > 0 ? 'font-medium text-bad' : 'text-ink-muted'}>
                          {opportunity.gap > 0 ? opportunity.gap.toLocaleString('en-IN') : 'Covered'}
                        </span>
                        <span className="block text-2xs text-ink-muted">
                          {opportunity.forecast > 0 ? `${((opportunity.gap / opportunity.forecast) * 100).toFixed(0)}% of demand` : '—'}
                        </span>
                      </Td>
                      <Td align="right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-semibold text-ink">{opportunity.score.toFixed(1)}</span>
                          <PriorityBadge priority={opportunity.priority} />
                        </div>
                      </Td>
                      <Td>
                        <ActionBadge action={opportunity.action} />
                        <span className="mt-1 block text-2xs text-ink-muted">{fmt(opportunity.contributionPerUnit)} / unit</span>
                      </Td>
                      <Td align="right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            navigate(`/opportunities/${opportunity.id}`)
                          }}
                        >
                          View <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </TableWrap>
            <Pagination page={current} pageCount={pageCount} total={filtered.length} onPage={setPage} />
          </>
        )}
      </Card>

      <p className="mt-3 text-2xs leading-relaxed text-ink-muted">
        Reliable availability discounts supplier capacity by confirmation history and data freshness. A sold-out signal is not assumed to be unmet
        demand; detail pages explain the evidence behind each recommendation.
      </p>
    </div>
  )
}
