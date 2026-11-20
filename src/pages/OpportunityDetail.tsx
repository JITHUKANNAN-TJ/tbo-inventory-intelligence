import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Lock,
  Pencil,
  ShieldAlert,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { CATEGORY_MAP } from '../data/categories'
import { SCORE_WEIGHTS, rationaleFor } from '../lib/scoring'
import { APPROVAL_ROLES } from '../lib/security'
import { formatDate, formatWeekRange } from '../lib/date'
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
  PriorityBadge,
  ProgressBar,
  StatCard,
  StatusBadge,
  TableWrap,
  Td,
  Term,
  Th,
  inputClass,
} from '../components/ui'

type ModalKind = 'approve' | 'reject' | 'monitor' | 'edit' | null

export function OpportunityDetailPage({ id }: { id?: string }) {
  const { opportunities, recommendations, decisions, dataset, profile, effectiveRole, fmt, destName, supplierName, decide, resetDecision, pushToast } = useApp()
  const opportunity = opportunities.find((item) => item.id === id)
  const recs = useMemo(() => recommendations.filter((rec) => rec.opportunityId === id), [recommendations, id])
  const [selectedSupplier, setSelectedSupplier] = useState<string | undefined>(recs[0]?.supplierId ?? opportunity?.quotes[0]?.supplierId)
  const [modal, setModal] = useState<ModalKind>(null)
  const [note, setNote] = useState('')
  const [editQty, setEditQty] = useState('')
  const [editRate, setEditRate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const canApprove = APPROVAL_ROLES.includes(effectiveRole)

  if (!opportunity) {
    return (
      <Card>
        <EmptyState
          title="Opportunity not found"
          description="This opportunity may have been removed from the imported dataset. Return to the opportunity list to continue."
          action={<Button onClick={() => navigate('/opportunities')}>Back to opportunities</Button>}
        />
      </Card>
    )
  }

  const category = CATEGORY_MAP[opportunity.category]
  const selectedRec = recs.find((rec) => rec.supplierId === selectedSupplier) ?? recs[0]
  const decision = selectedRec ? decisions[selectedRec.id] : undefined
  const isFlight = category.decision === 'access'
  const gapRatio = opportunity.gap / Math.max(1, opportunity.forecast)
  const supplier = selectedRec ? dataset.suppliers.find((item) => item.id === selectedRec.supplierId) : undefined
  const riskTone = opportunity.cancellationRisk > 0.2 ? 'danger' : opportunity.cancellationRisk > 0.12 ? 'warning' : 'success'
  const rationale = useMemo(() => {
    const best = opportunity.quotes.reduce(
      (acc, quote) => (quote.rate / Math.max(0.4, quote.reliability) < acc.rate / Math.max(0.4, acc.reliability) ? quote : acc),
      opportunity.quotes[0],
    )
    return rationaleFor(opportunity, supplierName(best.supplierId), (value) => fmt(value, false))
  }, [opportunity, supplierName, fmt])

  const openModal = (kind: Exclude<ModalKind, null>) => {
    if ((kind === 'approve' || kind === 'reject') && !canApprove) return
    setNote(decision?.note ?? '')
    if (selectedRec) {
      setEditQty(String(selectedRec.quantity))
      setEditRate(String(selectedRec.unitCost))
    }
    setModal(kind)
  }

  const closeModal = () => {
    setModal(null)
    setNote('')
  }

  const submitDecision = async (status: 'Approved' | 'Rejected' | 'Monitoring') => {
    if (!selectedRec || submitting) return
    setSubmitting(true)
    const ok = await decide(selectedRec.id, status, note.trim() || undefined)
    setSubmitting(false)
    if (!ok) return
    pushToast({
      tone: status === 'Rejected' ? 'error' : status === 'Monitoring' ? 'info' : 'success',
      title:
        status === 'Approved'
          ? 'Recommendation approved'
          : status === 'Rejected'
            ? 'Recommendation rejected'
            : 'Moved to monitoring',
      description: 'The decision, user, time and rationale are sealed in the audit trail.',
    })
    closeModal()
  }

  const saveEdit = async () => {
    if (!selectedRec || submitting) return
    const qty = Number(editQty)
    const rate = Number(editRate)
    const summary = `Working edit: quantity ${Number.isFinite(qty) ? qty : selectedRec.quantity}, target rate ${fmt(Number.isFinite(rate) ? rate : selectedRec.unitCost, false)}. ${note.trim()}`.trim()
    setSubmitting(true)
    const ok = await decide(selectedRec.id, 'Pending', summary)
    setSubmitting(false)
    if (!ok) return
    pushToast({ tone: 'info', title: 'Edit saved to the review note', description: 'Approval remains required before any commitment.' })
    closeModal()
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/opportunities')}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All opportunities
      </button>

      <PageHeader
        eyebrow={`${category.name} opportunity`}
        title={`${destName(opportunity.destinationId)} · ${formatWeekRange(opportunity.weekStart)}`}
        description={`${opportunity.weeksOut === 1 ? 'Next week' : `Travel in ${opportunity.weeksOut} weeks`} · ${category.unit} · opportunity score ${opportunity.score.toFixed(1)} of 100`}
        actions={
          <>
            {opportunity.id.startsWith('imp-') ? <Badge tone="outline">Imported CSV</Badge> : null}
            <PriorityBadge priority={opportunity.priority} />
            <ActionBadge action={opportunity.action} />
            {opportunity.eventLabel ? <Badge tone="warning">{opportunity.eventLabel}</Badge> : null}
          </>
        }
      />

      {decision && decision.status !== 'Pending' ? (
        <Notice tone={decision.status === 'Rejected' ? 'warning' : 'success'} className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={decision.status} />
            <span>{decision.note ?? 'Decision recorded.'}</span>
            <span className="text-2xs opacity-80">
              {decision.user} · {decision.at}
            </span>
          </span>
          {selectedRec ? (
            <Button variant="ghost" size="sm" onClick={() => void resetDecision(selectedRec.id)}>
              Reopen decision
            </Button>
          ) : null}
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Demand forecast"
          value={opportunity.forecast.toLocaleString('en-IN')}
          hint={`Range ${opportunity.forecastLow.toLocaleString('en-IN')} – ${opportunity.forecastHigh.toLocaleString('en-IN')} ${category.unit}`}
          tone="brand"
        />
        <StatCard
          label="Reliable availability"
          value={opportunity.reliableSupply.toLocaleString('en-IN')}
          hint={`${opportunity.quotes.length} supplier quotes · discounted by reliability and freshness`}
        />
        <StatCard
          label="Estimated gap"
          value={opportunity.gap.toLocaleString('en-IN')}
          hint={`${(gapRatio * 100).toFixed(0)}% of forecast demand is not covered`}
          tone={opportunity.gap > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Why this opportunity?" description="Evidence behind the score and the suggested action" />
            <div className="px-5 py-4">
              <ul className="space-y-2">
                {rationale.map((line) => (
                  <li key={line} className="flex gap-2 text-[13px] leading-relaxed text-ink-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {isFlight ? (
                <Notice tone="info" className="mt-4">
                  Flight inventory is treated as <strong>live fare access</strong>, not a pre-purchased quantity. The recommended action is to
                  protect connectivity and negotiate content rather than commit seats.
                </Notice>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Supplier comparison"
              description="Select a supplier to see the associated recommendation. Confirm live availability and contract terms before any commitment."
            />
            <TableWrap className="min-w-0">
              <thead>
                <tr>
                  <Th>Supplier</Th>
                  <Th align="right">Rate / unit</Th>
                  <Th align="right">Capacity</Th>
                  <Th align="right">Reliability</Th>
                  <Th>Flexibility</Th>
                  <Th align="right">Release</Th>
                  <Th align="center">Select</Th>
                </tr>
              </thead>
              <tbody>
                {opportunity.quotes.map((quote) => {
                  const quoteSupplier = dataset.suppliers.find((item) => item.id === quote.supplierId)
                  const isSelected = (selectedRec?.supplierId ?? selectedSupplier) === quote.supplierId
                  const hasRec = recs.some((rec) => rec.supplierId === quote.supplierId)
                  return (
                    <tr
                      key={quote.supplierId}
                      className={`data-row ${isSelected ? 'bg-brand-soft/40' : 'cursor-pointer hover:bg-canvas/60'}`}
                      onClick={() => setSelectedSupplier(quote.supplierId)}
                    >
                      <Td>
                        <span className="font-medium text-ink">{quoteSupplier?.name ?? quote.supplierId}</span>
                        <span className="block text-2xs text-ink-muted">
                          {quoteSupplier?.tier ?? 'Supplier'} · responds in ~{quoteSupplier?.responseHours ?? 12}h
                        </span>
                      </Td>
                      <Td align="right">{fmt(quote.rate, false)}</Td>
                      <Td align="right">{quote.capacity.toLocaleString('en-IN')}</Td>
                      <Td align="right">{(quote.reliability * 100).toFixed(1)}%</Td>
                      <Td>
                        <Badge tone={quote.flexibility === 'high' ? 'success' : quote.flexibility === 'medium' ? 'neutral' : 'warning'}>
                          {quote.flexibility}
                        </Badge>
                      </Td>
                      <Td align="right">{quote.releaseDays}d</Td>
                      <Td align="center">
                        <input
                          type="radio"
                          checked={isSelected}
                          onChange={() => setSelectedSupplier(quote.supplierId)}
                          aria-label={`Select ${quoteSupplier?.name ?? quote.supplierId}`}
                          className="h-3.5 w-3.5 accent-brand"
                        />
                        {hasRec ? <span className="ml-1 text-2xs text-brand">planned</span> : null}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </TableWrap>
          </Card>

          <Card>
            <CardHeader
              title="Recommended action"
              description={
                selectedRec
                  ? `Based on the ${planRiskLabel(selectedRec.tranches)} tranche and the selected supplier.`
                  : 'This opportunity is not part of the current allocation plan.'
              }
              action={selectedRec ? <ActionBadge action={selectedRec.action} /> : null}
            />
            {selectedRec ? (
              <div className="px-5 py-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">Quantity</p>
                    <p className="mt-1 text-lg font-semibold text-ink">
                      {selectedRec.quantity.toLocaleString('en-IN')}
                      <span className="ml-1 text-2xs font-normal text-ink-muted">{category.unit}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">Target rate</p>
                    <p className="mt-1 text-lg font-semibold text-ink">{fmt(selectedRec.unitCost, false)}</p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">Committed spend</p>
                    <p className="mt-1 text-lg font-semibold text-ink">{fmt(selectedRec.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">Expected contribution</p>
                    <p className="mt-1 text-lg font-semibold text-ok">{fmt(selectedRec.expectedContribution)}</p>
                    <p className="text-2xs text-ink-muted">Downside {fmt(selectedRec.downsideExposure)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <Button variant="primary" onClick={() => openModal('approve')} disabled={!canApprove}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve recommendation
                  </Button>
                  <Button variant="secondary" onClick={() => openModal('edit')}>
                    <Pencil className="h-3.5 w-3.5" /> Edit quantity / rate
                  </Button>
                  <Button variant="secondary" onClick={() => openModal('monitor')}>
                    <Eye className="h-3.5 w-3.5" /> Monitor
                  </Button>
                  <Button variant="danger" onClick={() => openModal('reject')} disabled={!canApprove}>
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                  <span className="ml-auto inline-flex items-center gap-1 text-2xs text-ink-muted">
                    {canApprove ? (
                      'Approval is recorded with owner, time and reason.'
                    ) : (
                      <>
                        <Lock className="h-3 w-3" /> Approver or Admin role required to decide.
                      </>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div className="px-5 py-5">
                <Notice tone="warning">
                  No allocation was generated for this opportunity under the current budget, category filters or risk profile. Increase the budget,
                  include {category.name.toLowerCase()}, or choose a higher risk profile in the budget optimizer.
                </Notice>
                <div className="mt-3 flex gap-2">
                  <Button variant="primary" onClick={() => navigate('/optimizer')}>
                    Open budget optimizer
                  </Button>
                  <Button variant="ghost" onClick={() => openModal('monitor')} disabled>
                    Monitor
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Pricing & purchase timing" description="Recommended sell price and when to commit" />
            <div className="space-y-3 px-5 py-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Supplier cost / unit</span>
                <span className="font-medium text-ink">{fmt(opportunity.bestUnitCost, false)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Recommended sell price</span>
                <span className="font-semibold text-ok">{fmt(Math.round(opportunity.bestUnitCost * 1.22), false)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Target margin</span>
                <span className="font-medium text-ink">~22% over cost</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Price band</span>
                <span className="font-medium text-ink">
                  {fmt(Math.round(opportunity.bestUnitCost * 1.15), false)} – {fmt(Math.round(opportunity.bestUnitCost * 1.32), false)}
                </span>
              </div>
              <div className="border-t border-line pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Buy-by date</span>
                  <span className="font-medium text-ink">
                    {(() => {
                      const d = new Date(`${opportunity.weekStart}T00:00:00Z`)
                      d.setUTCDate(d.getUTCDate() - category.leadDays)
                      return d.toISOString().slice(0, 10)
                    })()}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Lead time</span>
                  <span className="font-medium text-ink">{category.leadDays} days</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Release window</span>
                  <span className="font-medium text-ink">{opportunity.quotes[0]?.releaseDays ?? 21} days</span>
                </div>
              </div>
              <p className="pt-1 text-2xs leading-relaxed text-ink-muted">
                Commit before the buy-by date to protect the rate; release unsold units inside the release window to limit downside.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Risk" description="What could go wrong if demand is lower than expected" />
            <div className="space-y-4 px-5 py-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Unsold exposure</span>
                  <span className="font-medium text-ink">{selectedRec ? fmt(selectedRec.downsideExposure) : '—'}</span>
                </div>
                <ProgressBar value={selectedRec ? Math.min(1, selectedRec.downsideExposure / Math.max(1, selectedRec.totalCost)) : 0} tone="danger" />
                <p className="mt-1 text-2xs text-ink-muted">
                  Probability-weighted loss if committed units remain unsold at the release deadline.
                </p>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Cancellation risk</span>
                  <span className="font-medium text-ink">{(opportunity.cancellationRisk * 100).toFixed(1)}%</span>
                </div>
                <ProgressBar value={opportunity.cancellationRisk} tone={riskTone} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Forecast confidence</span>
                  <span className="font-medium text-ink">{(opportunity.confidence * 100).toFixed(0)}%</span>
                </div>
                <ProgressBar value={opportunity.confidence} tone="success" />
              </div>
              <div className="rounded-lg bg-canvas px-3 py-2 text-2xs leading-relaxed text-ink-muted">
                {supplier ? `${supplier.name} has ${(supplier.reliability * 100).toFixed(1)}% confirmation reliability and a ${(supplier.failureRate * 100).toFixed(1)}% failure rate.` : 'Supplier performance data is unavailable for this quote.'}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Demand signals" description="Recent search and booking behaviour" />
            <dl className="divide-y divide-line">
              {[
                {
                  label: <Term definition="Searches or availability requests divided by bookings. Lower is better; below 12 suggests strong purchase intent.">Look-to-book</Term>,
                  value: `1 : ${opportunity.ltb.toFixed(1)}`,
                },
                {
                  label: <Term definition="Share of recent availability checks that returned no suitable option. Simulated supplier timeouts are excluded.">Sold-out rate</Term>,
                  value: `${(opportunity.soldoutRate * 100).toFixed(1)}%`,
                },
                {
                  label: <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 4-week growth</span>,
                  value: `${opportunity.demandGrowth >= 0 ? '+' : ''}${(opportunity.demandGrowth * 100).toFixed(1)}%`,
                },
                {
                  label: 'Forecast range',
                  value: `${opportunity.forecastLow.toLocaleString('en-IN')} – ${opportunity.forecastHigh.toLocaleString('en-IN')}`,
                },
                {
                  label: 'Contribution / unit',
                  value: fmt(opportunity.contributionPerUnit, false),
                },
              ].map((row, index) => (
                <div key={index} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                  <dt className="text-ink-muted">{row.label}</dt>
                  <dd className="font-medium text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Score breakdown" description="Transparent weighting of demand, margin and supplier signals" />
            <div className="space-y-3 px-5 py-4">
              {SCORE_WEIGHTS.map((item) => {
                const value = opportunity.scoreBreakdown[item.key]
                return (
                  <div key={item.key}>
                    <div className="mb-1 flex items-center justify-between text-2xs">
                      <span className="text-ink-muted" title={item.hint}>
                        {item.label} <span className="text-ink-soft">· {Math.round(item.weight * 100)}%</span>
                      </span>
                      <span className="font-medium text-ink">{(value * 100).toFixed(0)}</span>
                    </div>
                    <ProgressBar value={value} tone="brand" />
                  </div>
                )
              })}
              <p className="pt-1 text-2xs leading-relaxed text-ink-muted">
                Scores rank opportunities for review. They are not a forecast of profit and should be recalibrated against realised outcomes.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Data freshness" description={`Snapshot: ${dataset.generatedAt}`} />
            <div className="space-y-2 px-5 py-4 text-2xs text-ink-muted">
              <p className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Availability snapshot</span>
                <span className="font-medium text-ink">{formatDate(opportunity.weekStart)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Supplier data</span>
                <span className="font-medium text-ink">{dataset.generatedAt}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Forecast model</span>
                <span className="font-medium text-ink">Blended baseline</span>
              </p>
              <p className="pt-1 leading-relaxed">
                Sample snapshot. Live deployments should show source-system timestamps and suppress stale recommendations.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={modal === 'approve'}
        onClose={closeModal}
        title="Approve recommendation"
        description={selectedRec ? `${selectedRec.quantity.toLocaleString('en-IN')} ${category.unit} · ${fmt(selectedRec.totalCost)} committed spend · ${supplierName(selectedRec.supplierId)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="success" onClick={() => void submitDecision('Approved')} disabled={!selectedRec || submitting}>
              {submitting ? 'Sealing…' : 'Approve & record'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Notice tone="info">
            Approval seals your name, role, time and note into the audit trail. This does not execute a purchase; the procurement team completes the
            commercial agreement separately.
          </Notice>
          <Field label="Decision note" hint="Optional">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              placeholder="e.g. Negotiated 6% below rack rate with a 21-day release window."
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={modal === 'reject'}
        onClose={closeModal}
        title="Reject recommendation"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="danger" onClick={() => void submitDecision('Rejected')} disabled={!note.trim() || !selectedRec || submitting}>
              {submitting ? 'Sealing…' : 'Reject & record'}
            </Button>
          </>
        }
      >
        <Field label="Reason for rejection" hint="Required">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            placeholder="Explain what would need to change before this opportunity is reconsidered."
          />
        </Field>
        <p className="mt-2 text-2xs text-ink-muted">Rejections are kept for model feedback and audit.</p>
      </Modal>

      <Modal
        open={modal === 'monitor'}
        onClose={closeModal}
        title="Move to monitoring"
        description="Keep the opportunity visible without committing budget."
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" onClick={() => void submitDecision('Monitoring')} disabled={!selectedRec || submitting}>
              {submitting ? 'Sealing…' : 'Save monitoring status'}
            </Button>
          </>
        }
      >
        <Field label="What should we watch?" hint="Optional">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            placeholder="e.g. Revisit once the airline schedule is published."
          />
        </Field>
      </Modal>

      <Modal
        open={modal === 'edit'}
        onClose={closeModal}
        title="Edit quantity and target rate"
        description="The edited values are saved as a working note. Approval is still required."
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" onClick={() => void saveEdit()} disabled={!selectedRec || submitting}>
              {submitting ? 'Sealing…' : 'Save edit'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Quantity (${category.unit})`}>
            <input type="number" min={0} value={editQty} onChange={(event) => setEditQty(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Target rate (INR)">
            <input type="number" min={0} value={editRate} onChange={(event) => setEditRate(event.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Reason for the edit" hint="Optional">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

function planRiskLabel(tranches: (1 | 2 | 3)[]): string {
  if (tranches.every((tier) => tier === 1)) return 'high-confidence'
  if (tranches.includes(3)) return 'speculative'
  return 'expected-demand'
}
