import { useMemo, useState } from 'react'
import { CheckCircle2, Download, ClipboardCheck, Lock, ShieldCheck, XCircle } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { CATEGORY_MAP } from '../data/categories'
import type { DecisionStatus, Recommendation } from '../types'
import { formatWeekRange } from '../lib/date'
import { buildRecommendationsCsv, downloadFile } from '../lib/csv'
import { APPROVAL_ROLES } from '../lib/security'
import { navigate } from '../app/router'
import {
  ActionBadge,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Modal,
  Notice,
  PageHeader,
  Pagination,
  StatCard,
  StatusBadge,
  TableWrap,
  Td,
  Term,
  Th,
} from '../components/ui'

const TABS: { key: 'All' | DecisionStatus; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Pending', label: 'Pending review' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' },
  { key: 'Monitoring', label: 'Monitoring' },
  { key: 'Completed', label: 'Completed' },
]

const PAGE_SIZE = 10

function riskLevel(rec: Recommendation) {
  if (rec.kind === 'access' || rec.totalCost === 0) return { label: 'Low', tone: 'neutral' as const }
  const ratio = rec.downsideExposure / rec.totalCost
  if (ratio > 0.3) return { label: 'High', tone: 'danger' as const }
  if (ratio > 0.15) return { label: 'Medium', tone: 'warning' as const }
  return { label: 'Low', tone: 'success' as const }
}

type PendingDecision = { rec: Recommendation; status: 'Approved' | 'Rejected' }

export function RecommendationsPage() {
  const {
    recommendations,
    completed,
    decisions,
    opportunities,
    dataset,
    profile,
    effectiveRole,
    audit,
    fmt,
    destName,
    supplierName,
    decide,
    pushToast,
  } = useApp()
  const [tab, setTab] = useState<'All' | DecisionStatus>('Pending')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState<PendingDecision | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const canApprove = APPROVAL_ROLES.includes(effectiveRole)

  const counts = useMemo(() => {
    const result: Record<string, number> = {
      All: recommendations.length,
      Pending: 0,
      Approved: 0,
      Rejected: 0,
      Monitoring: 0,
      Completed: completed.length,
    }
    recommendations.forEach((rec) => {
      result[decisions[rec.id]?.status ?? rec.status] += 1
    })
    return result
  }, [recommendations, decisions, completed.length])

  const approvedValue = recommendations
    .filter((rec) => rec.status === 'Approved')
    .reduce((sum, rec) => sum + rec.totalCost, 0)
  const approvedContribution = recommendations
    .filter((rec) => rec.status === 'Approved')
    .reduce((sum, rec) => sum + rec.expectedContribution, 0)
  const accepted = (counts.Approved ?? 0) + (counts.Completed ?? 0)
  const reviewed = accepted + (counts.Rejected ?? 0)

  const rows = useMemo(
    () => (tab === 'All' ? recommendations : recommendations.filter((rec) => rec.status === tab)),
    [recommendations, tab],
  )

  const pageCount = Math.ceil(rows.length / PAGE_SIZE)
  const current = Math.min(page, Math.max(1, pageCount))
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const changeTab = (next: 'All' | DecisionStatus) => {
    setTab(next)
    setPage(1)
  }

  const openDecision = (rec: Recommendation, status: 'Approved' | 'Rejected') => {
    if (!canApprove) return
    setNote('')
    setPending({ rec, status })
  }

  const closeDecision = () => {
    setPending(null)
    setNote('')
  }

  const confirmDecision = async () => {
    if (!pending || submitting) return
    setSubmitting(true)
    const ok = await decide(pending.rec.id, pending.status, note)
    setSubmitting(false)
    if (!ok) return
    pushToast({
      tone: pending.status === 'Approved' ? 'success' : 'error',
      title: pending.status === 'Approved' ? 'Recommendation approved' : 'Recommendation rejected',
      description: 'The decision, owner, time and rationale are sealed in the audit trail.',
    })
    closeDecision()
  }

  return (
    <div>
      <PageHeader
        eyebrow="Procurement decisions"
        title="Review and record decisions"
        description="Every procurement recommendation needs a human decision. Approvals capture the user, time and rationale for audit."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              downloadFile(
                'tbo-recommendations.csv',
                buildRecommendationsCsv([...recommendations, ...completed], opportunities, dataset.suppliers),
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Export decisions
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Pending review" value={counts.Pending ?? 0} hint="Awaiting an approver" tone="warning" icon={<ClipboardCheck className="h-3.5 w-3.5" />} delay={60} />
        <StatCard label="Approved commitment" value={fmt(approvedValue)} hint={`${counts.Approved ?? 0} recommendations approved`} tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} delay={120} />
        <StatCard label="Approved contribution" value={fmt(approvedContribution)} hint="Expected, risk-adjusted" icon={<Term definition="Expected revenue less supplier cost and variable expenses on approved recommendations.">Contribution</Term>} delay={180} />
        <StatCard
          label="Acceptance rate"
          value={reviewed > 0 ? `${((accepted / reviewed) * 100).toFixed(0)}%` : '—'}
          hint={`${accepted} accepted · ${counts.Rejected ?? 0} rejected`}
          tone="brand"
          icon={<XCircle className="h-3.5 w-3.5" />}
          delay={240}
        />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap gap-1 border-b border-line px-4 pt-3">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => changeTab(item.key)}
              className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                tab === item.key ? 'border-brand text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {item.label}
              <span className="ml-1.5 rounded-full bg-canvas px-1.5 py-0.5 text-2xs text-ink-muted">{counts[item.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {tab === 'Completed' ? (
          <CompletedTable />
        ) : visible.length === 0 ? (
          <EmptyState
            title={tab === 'Pending' ? 'Nothing waiting for review' : `No ${tab.toLowerCase()} recommendations`}
            description={
              tab === 'Pending'
                ? 'New recommendations appear here when the optimizer proposes a commitment under the current budget.'
                : 'Change the filter to see other recommendations or adjust the budget plan.'
            }
            action={<Button variant="secondary" onClick={() => navigate('/optimizer')}>Open budget optimizer</Button>}
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Recommendation</Th>
                  <Th>Supplier</Th>
                  <Th align="right">Quantity / commitment</Th>
                  <Th align="right">Budget impact</Th>
                  <Th align="right">
                    <Term definition="Expected revenue less supplier cost and variable expenses, risk-adjusted by tranche.">Expected contribution</Term>
                  </Th>
                  <Th>Risk</Th>
                  <Th>Owner / updated</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {visible.map((rec, index) => {
                  const opportunity = opportunities.find((item) => item.id === rec.opportunityId)
                  const category = opportunity ? CATEGORY_MAP[opportunity.category] : undefined
                  const risk = riskLevel(rec)
                  return (
                    <tr
                      key={rec.id}
                      className="animate-fade-up data-row cursor-pointer hover:bg-canvas/60"
                      style={{ animationDelay: `${Math.min(index, 15) * 35}ms` }}
                      onClick={() => navigate(`/opportunities/${rec.opportunityId}`)}
                    >
                      <Td>
                        <span className="font-medium text-ink">
                          {opportunity ? `${destName(opportunity.destinationId)} · ${category?.short}` : 'Opportunity'}
                        </span>
                        <span className="block text-2xs text-ink-muted">
                          {opportunity ? formatWeekRange(opportunity.weekStart) : '—'}
                        </span>
                        <span className="mt-1 inline-block">
                          <ActionBadge action={rec.action} />
                        </span>
                      </Td>
                      <Td>{rec.kind === 'access' ? 'Live supply' : supplierName(rec.supplierId)}</Td>
                      <Td align="right">
                        {rec.kind === 'access' ? (
                          <span className="text-2xs text-ink-muted">No pre-buy</span>
                        ) : (
                          <>
                            {rec.quantity.toLocaleString('en-IN')}
                            <span className="block text-2xs text-ink-muted">{category?.unit}</span>
                          </>
                        )}
                      </Td>
                      <Td align="right">{rec.kind === 'access' ? '—' : fmt(rec.totalCost)}</Td>
                      <Td align="right">
                        {rec.kind === 'access' ? (
                          <span className="text-2xs text-ink-muted">Access plan</span>
                        ) : (
                          <>
                            <span className="font-medium text-ok">{fmt(rec.expectedContribution)}</span>
                            <span className="block text-2xs text-ink-muted">downside {fmt(rec.downsideExposure)}</span>
                          </>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={risk.tone}>{risk.label}</Badge>
                      </Td>
                      <Td>
                        <span className="text-2xs text-ink">{rec.decidedBy ?? 'Unassigned'}</span>
                        <span className="block text-2xs text-ink-muted">{rec.decidedAt ?? 'Not reviewed'}</span>
                      </Td>
                      <Td>
                        <StatusBadge status={rec.status} />
                      </Td>
                      <Td align="right">
                        {rec.status === 'Pending' ? (
                          canApprove ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="success"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openDecision(rec, 'Approved')
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openDecision(rec, 'Rejected')
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 whitespace-nowrap text-2xs text-ink-muted"
                              title="Switch to Approver or Admin in Settings to record decisions."
                            >
                              <Lock className="h-3 w-3" /> Approval locked
                            </span>
                          )
                        ) : (
                          <Button variant="ghost" size="sm">Review</Button>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </TableWrap>
            <Pagination page={current} pageCount={pageCount} total={rows.length} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal
        open={pending !== null}
        onClose={closeDecision}
        title={pending?.status === 'Rejected' ? 'Reject recommendation' : 'Approve recommendation'}
        description={
          pending
            ? `${destName(opportunities.find((item) => item.id === pending.rec.opportunityId)?.destinationId ?? '')} · ${fmt(pending.rec.totalCost)} committed spend`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeDecision} disabled={submitting}>Cancel</Button>
            <Button
              variant={pending?.status === 'Rejected' ? 'danger' : 'success'}
              onClick={() => void confirmDecision()}
              disabled={submitting || (pending?.status === 'Rejected' && !note.trim())}
            >
              {submitting ? 'Sealing record…' : pending?.status === 'Rejected' ? 'Reject & record' : 'Approve & record'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Notice tone="info">
            Records {profile.name} ({profile.role}), the current time and this rationale in a SHA-256 audit chain. No purchase is executed.
          </Notice>
          <Field
            label={pending?.status === 'Rejected' ? 'Reason for rejection' : 'Decision rationale'}
            hint={pending?.status === 'Rejected' ? 'Required' : 'Recommended for audit'}
          >
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              maxLength={1200}
              className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              placeholder="e.g. Rate is inside target and the 21-day release window limits unsold exposure."
            />
          </Field>
          <p className="flex items-center gap-1.5 text-2xs text-ink-muted">
            <ShieldCheck className="h-3 w-3 shrink-0" /> {audit.message}
          </p>
        </div>
      </Modal>

      <p className="mt-3 text-2xs leading-relaxed text-ink-muted">
        Approval is limited to the Approver and Admin roles in this workspace and sealed into a browser-local audit chain. These client-side controls
        are not server authorization; production must enforce roles and retain audit records server-side.
      </p>
    </div>
  )
}

function CompletedTable() {
  const { completed, opportunities, fmt, destName, supplierName } = useApp()

  if (completed.length === 0) {
    return <EmptyState title="No completed outcomes yet" description="Outcome tracking appears once a travel period closes and realised bookings are reconciled." />
  }

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Opportunity</Th>
          <Th>Supplier</Th>
          <Th align="right">Procured</Th>
          <Th align="right">Sold</Th>
          <Th align="right">Unsold</Th>
          <Th align="right">
            <Term definition="Actual contribution after the travel period, including unsold write-offs.">Realised profit</Term>
          </Th>
          <Th align="right">Forecast accuracy</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {completed.map((rec, index) => {
          const opportunity = opportunities.find((item) => item.id === rec.opportunityId)
          if (!opportunity) return null
          const accuracy = 1 - Math.abs(rec.realised!.sold - rec.quantity) / Math.max(1, rec.quantity)
          return (
            <tr
              key={rec.id}
              className="animate-fade-up data-row"
              style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
            >
              <Td>
                <span className="font-medium text-ink">
                  {destName(opportunity.destinationId)} · {CATEGORY_MAP[opportunity.category].short}
                </span>
                <span className="block text-2xs text-ink-muted">{formatWeekRange(opportunity.weekStart)}</span>
              </Td>
              <Td>{supplierName(rec.supplierId)}</Td>
              <Td align="right">{rec.quantity.toLocaleString('en-IN')}</Td>
              <Td align="right">{rec.realised!.sold.toLocaleString('en-IN')}</Td>
              <Td align="right">{rec.realised!.unsold.toLocaleString('en-IN')}</Td>
              <Td align="right">
                <span className="font-medium text-ok">{fmt(rec.realised!.profit)}</span>
              </Td>
              <Td align="right">{(Math.max(0, accuracy) * 100).toFixed(0)}%</Td>
              <Td>
                <StatusBadge status="Completed" />
              </Td>
            </tr>
          )
        })}
      </tbody>
    </TableWrap>
  )
}
