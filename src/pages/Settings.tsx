import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileUp,
  KeyRound,
  Lock,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import type { Profile } from '../types'
import {
  buildAuditCsv,
  buildHistoryCsv,
  buildOpportunitiesCsv,
  buildRecommendationsCsv,
  buildSuppliersCsv,
  downloadFile,
  downloadTemplate,
} from '../lib/csv'
import { buildSecurityLogCsv } from '../lib/securityLog'
import { securityPosture, isPrivilegedRole, type PostureCheck } from '../lib/security'
import { Badge, Button, Card, CardHeader, Field, Modal, Notice, PageHeader, inputClass, selectClass } from '../components/ui'

export function SettingsPage() {
  const {
    dataset,
    opportunities,
    imported,
    importSummary,
    recommendations,
    completed,
    decisions,
    audit,
    profile,
    effectiveRole,
    sessionLocked,
    lockSession,
    unlockSession,
    setProfile,
    importFile,
    clearImported,
    resetDemo,
    pushToast,
    securityLog,
    securityAudit,
  } = useApp()
  const [name, setName] = useState(profile.name)
  const [role, setRole] = useState<Profile['role']>(profile.role)
  const fileRef = useRef<HTMLInputElement>(null)
  const [posture, setPosture] = useState<PostureCheck[]>([])
  const [confirmElevate, setConfirmElevate] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const auditTone =
    audit.status === 'verified'
      ? ('success' as const)
      : audit.status === 'invalid'
        ? ('danger' as const)
        : audit.status === 'unavailable'
          ? ('warning' as const)
          : ('neutral' as const)

  const securityTone =
    securityAudit.status === 'verified'
      ? ('success' as const)
      : securityAudit.status === 'invalid'
        ? ('danger' as const)
        : securityAudit.status === 'unavailable'
          ? ('warning' as const)
          : ('neutral' as const)

  const refreshPosture = () => {
    void securityPosture().then(setPosture)
  }
  useEffect(() => {
    refreshPosture()
  }, [])

  const saveProfile = () => {
    const elevating = isPrivilegedRole(role) && !isPrivilegedRole(profile.role) && role !== profile.role
    if (elevating) {
      setConfirmElevate(true)
      return
    }
    const ok = setProfile({ name: name.trim() || 'Unnamed user', role })
    if (ok) {
      pushToast({ tone: 'success', title: 'Profile saved', description: 'Decisions you record will use this name and role.' })
    }
  }

  const confirmSaveProfile = () => {
    const ok = setProfile({ name: name.trim() || 'Unnamed user', role }, true)
    setConfirmElevate(false)
    if (ok) {
      pushToast({ tone: 'success', title: 'Privileges granted', description: `Role set to ${role}.` })
    }
  }

  const handleReset = () => {
    setConfirmReset(false)
    resetDemo()
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Data, profile and governance"
        description="Manage the sample dataset, import opportunities and review the controls applied to procurement decisions."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title="Dataset"
              description={`Sample dataset · ${dataset.generatedAt}`}
              action={<Badge tone="warning"><span className="h-1.5 w-1.5 rounded-full bg-warn" /> Synthetic data</Badge>}
            />
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2.5">
                <p className="text-2xs text-ink-muted">Data generated</p>
                <p className="mt-0.5 text-sm font-medium text-ink">{dataset.generatedAt}</p>
                <p className="mt-1 text-2xs text-ink-muted">Historical weeks and forward opportunities for planning review</p>
              </div>
              <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2.5">
                <p className="text-2xs text-ink-muted">Coverage</p>
                <p className="mt-0.5 text-sm font-medium text-ink">
                  {dataset.destinations.length} destinations · {dataset.suppliers.length} suppliers
                </p>
                <p className="mt-1 text-2xs text-ink-muted">
                  {dataset.history.length.toLocaleString('en-IN')} weekly history rows · {opportunities.length.toLocaleString('en-IN')} forward
                  opportunities
                </p>
              </div>
            </div>
            <div className="border-t border-line px-5 py-4">
              <p className="mb-2 text-xs font-medium text-ink">Export</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => downloadFile('tbo-history.csv', buildHistoryCsv(dataset.history, dataset.destinations))}>
                  <Download className="h-3.5 w-3.5" /> History
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadFile('tbo-opportunities.csv', buildOpportunitiesCsv(opportunities, dataset.suppliers, dataset.destinations))}
                >
                  <Download className="h-3.5 w-3.5" /> Opportunities
                </Button>
                <Button variant="secondary" size="sm" onClick={() => downloadFile('tbo-suppliers.csv', buildSuppliersCsv(dataset.suppliers, dataset.destinations))}>
                  <Download className="h-3.5 w-3.5" /> Suppliers
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    downloadFile('tbo-recommendations.csv', buildRecommendationsCsv([...recommendations, ...completed], opportunities, dataset.suppliers))
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Recommendations
                </Button>
                <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                  <FileUp className="h-3.5 w-3.5" /> Import template
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
                  <Database className="h-3.5 w-3.5 text-ink-soft" /> Reset the workspace
                </p>
                <p className="mt-0.5 text-2xs text-ink-muted">Clears saved plan, decisions, profile and imported rows, then reloads the sample dataset.</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset workspace
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Import opportunities"
              description="Accepted CSV columns: category, destination, week_start, forecast_units, reliable_supply (optional: forecast_low, forecast_high, look_to_book)"
              action={<Button variant="ghost" size="sm" onClick={downloadTemplate}><Download className="h-3.5 w-3.5" /> Template</Button>}
            />
            <div className="px-5 py-4">
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-canvas/50 px-6 py-8 text-center hover:border-brand/50"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const file = event.dataTransfer.files[0]
                  if (file) void importFile(file)
                }}
              >
                <Upload className="h-5 w-5 text-ink-soft" />
                <span className="text-xs font-medium text-ink">Drop a CSV here or click to browse</span>
                <span className="text-2xs text-ink-muted">
                  Up to 2 MB and 5,000 rows. Valid rows are appended and clearly marked as imported.
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void importFile(file)
                    event.target.value = ''
                  }}
                />
              </label>

              {importSummary ? (
                <div className="mt-4 rounded-lg border border-line">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                    <p className="text-xs font-medium text-ink">{importSummary.fileName}</p>
                    <div className="flex gap-1.5">
                      <Badge tone="success">{importSummary.accepted} accepted</Badge>
                      {importSummary.rejected > 0 ? <Badge tone="danger">{importSummary.rejected} rejected</Badge> : null}
                    </div>
                  </div>
                  <div className="px-3.5 py-3 text-2xs text-ink-muted">
                    <p>
                      {importSummary.rows} data rows read. {importSummary.accepted} imported opportunities are included in the opportunity list and
                      budget optimizer.
                    </p>
                    {importSummary.errors.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {importSummary.errors.map((error) => (
                          <li key={error} className="flex gap-1.5 text-bad">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {error}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {imported.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-3.5 py-2.5">
                  <p className="text-2xs text-ink-muted">
                    <span className="font-medium text-ink">{imported.length}</span> imported opportunities in this workspace
                  </p>
                  <Button variant="ghost" size="sm" onClick={clearImported}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove imported rows
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Method and assumptions" description="Decision rules used by this workspace" />
            <div className="space-y-2.5 px-5 py-4 text-[13px] leading-relaxed text-ink-muted">
              {[
                'Booking, search, supplier, rate and contract records are sample data for evaluation only.',
                'Live or API-accessed inventory is treated as a connectivity decision; only contracted or committed inventory receives a purchase quantity.',
                'A sold-out search is not assumed to equal unmet demand. Simulation timeouts are excluded from the sold-out signal.',
                'Forecast baselines blend the same week last year with the last four weeks of demand.',
                'Budget allocation applies a reserve, an access allowance, supplier exposure caps and optional category caps.',
                'No purchase is executed. Approvals capture the decision owner, time and rationale.',
              ].map((item) => (
                <p key={item} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-soft" />
                  {item}
                </p>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Security posture"
              description="Runtime checks for the current browser and build"
              action={<Button variant="ghost" size="sm" onClick={refreshPosture}>Re-check</Button>}
            />
            <ul className="divide-y divide-line">
              {posture.map((check) => (
                <li key={check.id} className="flex items-start justify-between gap-3 px-5 py-3 text-xs">
                  <div>
                    <p className="font-medium text-ink">{check.label}</p>
                    <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{check.detail}</p>
                  </div>
                  <Badge tone={check.state === 'pass' ? 'success' : check.state === 'warn' ? 'warning' : 'danger'}>
                    {check.state === 'pass' ? 'Pass' : check.state === 'warn' ? 'Warn' : 'Fail'}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Session security"
              description="Idle lock and privileged access"
              action={
                <Badge tone={sessionLocked ? 'warning' : 'success'}>
                  {sessionLocked ? 'Locked' : 'Active'}
                </Badge>
              }
            />
            <div className="space-y-3 px-5 py-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2">
                  <p className="text-2xs text-ink-muted">Effective role</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{effectiveRole}</p>
                </div>
                <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2">
                  <p className="text-2xs text-ink-muted">Auto-lock</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">15 minutes</p>
                </div>
              </div>
              <p className="leading-relaxed text-ink-muted">
                A privileged session drops to Inventory Analyst after 15 minutes of inactivity. Decisions, profile saves
                and imports are also rate-limited. The log below records every lock, elevation and blocked action.
              </p>
              <div className="flex flex-wrap gap-2">
                {sessionLocked ? (
                  <Button variant="primary" size="sm" className="w-full" onClick={unlockSession}>
                    <KeyRound className="h-3.5 w-3.5" /> Unlock session
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => lockSession('Locked manually from Settings.')}>
                    <Lock className="h-3.5 w-3.5" /> Lock session now
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Security log"
              description="Hash-chained record of security-relevant actions"
              action={<Badge tone={securityTone}>{securityAudit.status}</Badge>}
            />
            <div className="space-y-3 px-5 py-4 text-xs">
              <p className="leading-relaxed text-ink-muted">{securityAudit.message}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2">
                  <p className="text-2xs text-ink-muted">Events checked</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{securityAudit.checked}</p>
                </div>
                <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2">
                  <p className="text-2xs text-ink-muted">Failed checks</p>
                  <p className={`mt-0.5 text-sm font-medium ${securityAudit.invalidIds.length > 0 ? 'text-bad' : 'text-ink'}`}>
                    {securityAudit.invalidIds.length}
                  </p>
                </div>
              </div>
              {securityLog.length > 0 ? (
                <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                  {securityLog
                    .slice()
                    .reverse()
                    .slice(0, 12)
                    .map((event) => (
                      <li key={event.id} className="px-3 py-2 text-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-ink">{event.event}</span>
                          <span className="text-ink-muted">{event.at}</span>
                        </div>
                        {event.detail ? <p className="mt-0.5 leading-relaxed text-ink-muted">{event.detail}</p> : null}
                        {event.actor ? <p className="mt-0.5 text-ink-soft">by {event.actor}</p> : null}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-2xs text-ink-muted">No security events recorded yet.</p>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={securityLog.length === 0}
                onClick={() => downloadFile('tbo-security-log.csv', buildSecurityLogCsv(securityLog))}
              >
                <Download className="h-3.5 w-3.5" /> Export security log
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Decision integrity" description="SHA-256 chain over recorded decisions" action={<Badge tone={auditTone}>{audit.status}</Badge>} />
            <div className="space-y-3 px-5 py-4 text-xs">
              <p className="leading-relaxed text-ink-muted">{audit.message}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2">
                  <p className="text-2xs text-ink-muted">Records checked</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{audit.checked}</p>
                </div>
                <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2">
                  <p className="text-2xs text-ink-muted">Failed checks</p>
                  <p className={`mt-0.5 text-sm font-medium ${audit.invalidIds.length > 0 ? 'text-bad' : 'text-ink'}`}>
                    {audit.invalidIds.length}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={Object.keys(decisions).length === 0}
                onClick={() => downloadFile('tbo-audit-log.csv', buildAuditCsv(decisions, recommendations, opportunities, audit))}
              >
                <Download className="h-3.5 w-3.5" /> Export audit log
              </Button>
              <p className="text-2xs leading-relaxed text-ink-muted">
                Hashes detect changes to browser-stored records. They are not server authorization; production approvals and audit logs must be
                enforced server-side.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Profile and role" description="Used on decision audit records" />
            <div className="space-y-3 px-5 py-4">
              <Field label="Display name" htmlFor="profile-name">
                <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Role" htmlFor="profile-role" hint="Approver and Admin can record decisions">
                <select id="profile-role" value={role} onChange={(event) => setRole(event.target.value as Profile['role'])} className={selectClass}>
                  <option value="Inventory Analyst">Inventory Analyst</option>
                  <option value="Approver">Approver</option>
                  <option value="Admin">Admin</option>
                </select>
              </Field>
              <Button variant="primary" className="w-full" onClick={saveProfile}>
                <UserRound className="h-3.5 w-3.5" /> Save profile
              </Button>
              <p className="text-2xs leading-relaxed text-ink-muted">
                Role selection controls this browser only. A production system must verify identity and authority on the server.
                {sessionLocked ? ' The session is currently locked; unlock it before taking on a privileged role.' : ''}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Data sources" description="Current status of each input" />
            <ul className="divide-y divide-line">
              {[
                { label: 'Booking & search history', value: 'Sample dataset', ok: true },
                { label: 'Supplier rates & availability', value: 'Sample snapshots', ok: true },
                { label: 'Contract terms', value: 'Sample release windows', ok: true },
                { label: 'Live supplier APIs', value: 'Awaiting integration', ok: false },
                { label: 'Booking engine / execution', value: 'Out of scope', ok: false },
                { label: 'Event calendar', value: 'Sample calendar', ok: true },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs">
                  <span className="text-ink-muted">{row.label}</span>
                  <span className={row.ok ? 'inline-flex items-center gap-1 text-ink' : 'inline-flex items-center gap-1 text-warn'}>
                    {row.ok ? <CheckCircle2 className="h-3 w-3 text-ok" /> : <AlertTriangle className="h-3 w-3" />}
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Notice tone="warning">
            Decision support only. This workspace does not purchase, hold or sell travel inventory. Connect a production approval workflow before
            commercial use.
          </Notice>
        </div>
      </div>

      <Modal
        open={confirmElevate}
        title="Grant elevated privileges?"
        description="Switching to an Approver or Admin role lets this browser record procurement decisions."
        onClose={() => setConfirmElevate(false)}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmElevate(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={confirmSaveProfile}>
              <ShieldCheck className="h-3.5 w-3.5" /> Grant role
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-ink-muted">
          The change is recorded in the security log and the audit trail. Identity is still verified only inside this browser;
          production must enforce it on the server.
        </p>
      </Modal>

      <Modal
        open={confirmReset}
        title="Reset the workspace?"
        description="This clears the saved plan, decisions, profile and imported rows, then reloads the sample dataset."
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-ink-muted">
          The security log is retained so the reset itself is auditable. This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}