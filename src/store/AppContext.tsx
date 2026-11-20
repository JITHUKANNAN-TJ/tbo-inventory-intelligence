import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Dataset,
  Decision,
  DecisionStatus,
  ImportSummary,
  Opportunity,
  PlanConfig,
  Profile,
  Recommendation,
  Toast,
} from '../types'
import { buildDataset } from '../data/generators'
import { CATEGORY_MAP } from '../data/categories'
import { DEFAULT_PLAN, buildCompletedOutcomes, buildRecommendations, optimise } from '../lib/optimiser'
import { importOpportunitiesCsv, MAX_IMPORT_BYTES } from '../lib/csv'
import type { AuditVerification } from '../lib/integrity'
import {
  getLastDecisionHash,
  hashDecision,
  isIntegrityAvailable,
  sealDecisionStore,
  verifyDecisionChain,
} from '../lib/integrity'
import { canRecordDecision, sanitizeNote, safeLabel } from '../lib/security'
import {
  DEFAULT_ROLE,
  IDLE_LOCK_MS,
  ROLES,
  allowAction,
  isPrivilegedRole,
  safeParse,
  sanitizeName,
  sanitizePlanPatch,
  sanitizeProfile,
} from '../lib/security'
import {
  SECURITY_LOG_KEY,
  appendSecurityEvent,
  readSecurityLog,
  verifySecurityLog,
  type SecurityEvent,
  type SecurityLogVerification,
} from '../lib/securityLog'
import { money } from '../lib/format'

const KEYS = {
  plan: 'tbo.plan.v1',
  decisions: 'tbo.decisions.v1',
  profile: 'tbo.profile.v1',
  imported: 'tbo.imported.v1',
  seeded: 'tbo.seeded.v1',
  securityLog: SECURITY_LOG_KEY,
}

function readJson<T>(key: string, fallback: T): T {
  try {
    // safeParse enforces size/depth limits and strips prototype-pollution keys.
    return safeParse<T>(window.localStorage.getItem(key), fallback)
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage quota / privacy-mode failures.
  }
}

function readDecisionStore(): Record<string, Decision> {
  const raw = readJson<unknown>(KEYS.decisions, {})
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const valid = Object.entries(raw).filter(
    ([key, value]) => key.length > 0 && !!value && typeof value === 'object' && typeof (value as Decision).status === 'string',
  ) as [string, Decision][]
  // Cap the store so a tampered entry cannot grow without bound.
  return Object.fromEntries(valid.slice(-500))
}

const EMPTY_AUDIT: AuditVerification = {
  status: 'empty',
  checked: 0,
  invalidIds: [],
  message: 'No decisions have been recorded yet.',
}

const EMPTY_SECURITY_AUDIT: SecurityLogVerification = {
  status: 'empty',
  checked: 0,
  invalidIds: [],
  message: 'No security events recorded yet.',
}

interface AppContextValue {
  dataset: Dataset
  opportunities: Opportunity[]
  imported: Opportunity[]
  importSummary: ImportSummary | null
  plan: PlanConfig
  setPlan: (updater: Partial<PlanConfig> | ((current: PlanConfig) => PlanConfig)) => void
  optimizer: ReturnType<typeof optimise>
  baselinePlan: PlanConfig
  baseline: ReturnType<typeof optimise>
  recommendations: Recommendation[]
  completed: Recommendation[]
  decisions: Record<string, Decision>
  audit: AuditVerification
  decide: (recommendationId: string, status: DecisionStatus, note?: string) => Promise<boolean>
  resetDecision: (recommendationId: string) => Promise<boolean>
  runOptimisation: () => void
  profile: Profile
  setProfile: (profile: Profile, confirmed?: boolean) => boolean
  sessionLocked: boolean
  effectiveRole: Profile['role']
  lockSession: (reason?: string) => void
  unlockSession: () => void
  securityLog: SecurityEvent[]
  securityAudit: SecurityLogVerification
  logSecurityEvent: (event: string, detail?: string) => void
  fmt: (value: number, compact?: boolean) => string
  destName: (id: string) => string
  supplierName: (id: string) => string
  opportunityLabel: (opportunity: Opportunity) => string
  toasts: Toast[]
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  importFile: (file: File) => Promise<ImportSummary>
  clearImported: () => void
  resetDemo: () => void
  lastRunAt: string | null
}

const AppContext = createContext<AppContextValue | null>(null)

const SEED_NOTES: { status: DecisionStatus; note: string }[] = [
  { status: 'Approved', note: 'Approved after supplier call. Release window of 21 days keeps unsold exposure inside policy.' },
  { status: 'Approved', note: 'Rate 6% below the current live average; commitment capped at the high-confidence tranche.' },
  { status: 'Monitoring', note: 'Demand trend is improving but the event calendar is still uncertain. Revisit in 7 days.' },
  { status: 'Rejected', note: 'Supplier confirmation history is weak for this destination and the rate is above target.' },
  { status: 'Approved', note: 'Approved with a reduced quantity; remaining gap covered through live supply.' },
]

export function AppProvider({ children }: { children: ReactNode }) {
  const [dataset] = useState<Dataset>(() => buildDataset((value) => money(value, 'INR')))
  const [plan, setPlanState] = useState<PlanConfig>(() => {
    const patch = sanitizePlanPatch(readJson<unknown>(KEYS.plan, {}))
    return { ...DEFAULT_PLAN, ...patch }
  })
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() => readDecisionStore())
  const [audit, setAudit] = useState<AuditVerification>(EMPTY_AUDIT)
  const [profile, setProfileState] = useState<Profile>(() =>
    sanitizeProfile(readJson<unknown>(KEYS.profile, null), { name: 'Sarveshwaran', role: 'Approver' }),
  )
  const [imported, setImported] = useState<Opportunity[]>(() => {
    const parsed = readJson<unknown>(KEYS.imported, [])
    return Array.isArray(parsed) ? (parsed as Opportunity[]) : []
  })
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [baselinePlan, setBaselinePlan] = useState<PlanConfig>(plan)
  const [lastRunAt, setLastRunAt] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [sessionLocked, setSessionLockedState] = useState(false)
  const [securityLog, setSecurityLog] = useState<SecurityEvent[]>(() => readSecurityLog())
  const [securityAudit, setSecurityAudit] = useState<SecurityLogVerification>(EMPTY_SECURITY_AUDIT)
  const seededRef = useRef(false)
  const decisionsRef = useRef(decisions)
  const sessionLockedRef = useRef(false)
  const securityLogRef = useRef(securityLog)
  const logQueueRef = useRef<Promise<void>>(Promise.resolve())
  const lastActivityRef = useRef(Date.now())
  const profileRef = useRef(profile)

  const opportunities = useMemo(() => [...dataset.opportunities, ...imported], [dataset.opportunities, imported])
  const optimizer = useMemo(() => optimise(opportunities, plan), [opportunities, plan])
  const baseline = useMemo(() => optimise(opportunities, baselinePlan), [opportunities, baselinePlan])
  const recommendations = useMemo(
    () => buildRecommendations(optimizer, opportunities, decisions),
    [optimizer, opportunities, decisions],
  )
  const completed = useMemo(() => buildCompletedOutcomes(opportunities), [opportunities])

  const fmt = useCallback((value: number, compact = true) => money(value, plan.currency, compact), [plan.currency])

  const destinationName = useMemo(
    () => new Map(dataset.destinations.map((destination) => [destination.id, destination.city])),
    [dataset.destinations],
  )
  const supplierNameMap = useMemo(
    () => new Map(dataset.suppliers.map((supplier) => [supplier.id, supplier.name])),
    [dataset.suppliers],
  )
  const destName = useCallback((id: string) => destinationName.get(id) ?? id, [destinationName])
  const supplierName = useCallback((id: string) => supplierNameMap.get(id) ?? id, [supplierNameMap])
  const opportunityLabel = useCallback(
    (opportunity: Opportunity) => `${destinationName.get(opportunity.destinationId) ?? opportunity.destinationId} · ${CATEGORY_MAP[opportunity.category].short}`,
    [destinationName],
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
      setToasts((current) => [...current.slice(-2), { ...toast, id }])
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id))
      }, 4500)
    },
    [],
  )

  const logSecurityEvent = useCallback((event: string, detail?: string) => {
    logQueueRef.current = logQueueRef.current
      .then(() => appendSecurityEvent(securityLogRef.current, { event, detail, actor: profileRef.current.name }))
      .then((next) => {
        securityLogRef.current = next
        setSecurityLog(next)
      })
      .catch(() => undefined)
  }, [])

  const lockSession = useCallback((reason = 'Locked manually from Settings.') => {
    if (sessionLockedRef.current) return
    sessionLockedRef.current = true
    setSessionLockedState(true)
    logSecurityEvent('session.locked', reason)
    pushToast({ tone: 'info', title: 'Session locked', description: 'Privileges dropped to Inventory Analyst. Unlock from Settings to approve again.' })
  }, [logSecurityEvent, pushToast])

  const unlockSession = useCallback(() => {
    if (!sessionLockedRef.current) return
    sessionLockedRef.current = false
    setSessionLockedState(false)
    lastActivityRef.current = Date.now()
    logSecurityEvent('session.unlocked', 'Session unlocked by the user.')
    pushToast({ tone: 'success', title: 'Session unlocked', description: `Active role: ${profileRef.current.role}.` })
  }, [logSecurityEvent, pushToast])

  const setPlan = useCallback((updater: Partial<PlanConfig> | ((current: PlanConfig) => PlanConfig)) => {
    setPlanState((current) => {
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater }
      writeJson(KEYS.plan, next)
      return next
    })
  }, [])

  const decide = useCallback(
    async (recommendationId: string, status: DecisionStatus, note?: string): Promise<boolean> => {
      if (sessionLockedRef.current) {
        logSecurityEvent('decision.denied', `Session locked; ${status} decision blocked.`)
        pushToast({ tone: 'error', title: 'Session locked', description: 'Unlock the session in Settings before recording a decision.' })
        return false
      }
      if (!canRecordDecision(profile.role, status)) {
        logSecurityEvent('decision.denied', `${profile.role} attempted to record ${status}.`)
        pushToast({
          tone: 'error',
          title: 'Approver role required',
          description: 'Switch to Approver or Admin in Settings to approve or reject a recommendation.',
        })
        return false
      }
      if (!allowAction('decision', 10, 60_000)) {
        logSecurityEvent('action.rate-limited', 'Decision recording exceeded 10 per minute.')
        pushToast({ tone: 'error', title: 'Too many decisions', description: 'Wait a moment before recording another decision.' })
        return false
      }
      const cleanNote = sanitizeNote(note)
      if (status === 'Rejected' && !cleanNote) {
        pushToast({ tone: 'error', title: 'Reason required', description: 'Add a rejection reason before recording the decision.' })
        return false
      }
      if (!isIntegrityAvailable()) {
        pushToast({
          tone: 'error',
          title: 'Audit logging unavailable',
          description: 'Open the app over HTTPS so the decision can be sealed with SHA-256.',
        })
        return false
      }

      const record: Decision = {
        status,
        note: cleanNote,
        user: sanitizeName(profile.name) || 'Unnamed user',
        userRole: profile.role,
        at: new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
      }

      try {
        // Re-appending a moved key keeps the integrity chain in chronological order.
        const rest = { ...decisionsRef.current }
        delete rest[recommendationId]
        record.previousHash = getLastDecisionHash(rest)
        record.hash = await hashDecision(record, recommendationId)
        const next: Record<string, Decision> = { ...rest, [recommendationId]: record }
        decisionsRef.current = next
        setDecisions(next)
        writeJson(KEYS.decisions, next)
        return true
      } catch {
        pushToast({
          tone: 'error',
          title: 'Decision not recorded',
          description: 'The browser could not seal the audit record. Try again.',
        })
        return false
      }
    },
    [profile.name, profile.role, pushToast, logSecurityEvent],
  )

  const resetDecision = useCallback(
    async (recommendationId: string): Promise<boolean> =>
      decide(recommendationId, 'Pending', 'Decision reopened for review; the earlier decision remains in the audit trail.'),
    [decide],
  )

  const runOptimisation = useCallback(() => {
    setBaselinePlan(plan)
    setLastRunAt(new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))
    pushToast({
      tone: 'success',
      title: 'Optimization complete',
      description: 'The proposed allocation has been refreshed. Nothing is purchased until recommendations are approved.',
    })
  }, [plan, pushToast])

  const setProfile = useCallback((next: Profile, confirmed = false): boolean => {
    const clean: Profile = {
      name: sanitizeName(next.name) || 'Unnamed user',
      role: (ROLES as string[]).includes(next.role) ? next.role : DEFAULT_ROLE,
    }
    const elevating = isPrivilegedRole(clean.role) && !isPrivilegedRole(profile.role)

    if (sessionLockedRef.current && isPrivilegedRole(clean.role)) {
      pushToast({ tone: 'error', title: 'Session locked', description: 'Unlock the session in Settings before taking on a privileged role.' })
      return false
    }
    if (elevating && !confirmed) {
      pushToast({ tone: 'info', title: 'Confirmation required', description: 'Confirm the privilege change before the role is applied.' })
      return false
    }
    if (!allowAction('profile', 6, 60_000)) {
      logSecurityEvent('action.rate-limited', 'Profile saves exceeded 6 per minute.')
      pushToast({ tone: 'error', title: 'Too many profile changes', description: 'Wait a minute before changing the profile again.' })
      return false
    }

    setProfileState(clean)
    writeJson(KEYS.profile, clean)
    if (elevating) logSecurityEvent('role.elevated', `Role changed to ${clean.role}.`)
    else logSecurityEvent('profile.saved', `Profile saved with role ${clean.role}.`)
    return true
  }, [profile.role, pushToast, logSecurityEvent])

  const importFile = useCallback(
    async (file: File) => {
      const fileName = safeLabel(file.name, 120)
      if (!allowAction('import', 5, 60_000)) {
        logSecurityEvent('import.blocked', `Rate limit hit while importing ${fileName}.`)
        const summary: ImportSummary = { fileName, rows: 0, accepted: 0, rejected: 0, errors: ['Too many imports. Wait a minute before trying again.'] }
        setImportSummary(summary)
        pushToast({ tone: 'error', title: 'Too many imports', description: summary.errors[0] })
        return summary
      }
      if (!file.name.toLowerCase().endsWith('.csv')) {
        logSecurityEvent('import.blocked', `Rejected non-CSV file ${fileName}.`)
        const summary: ImportSummary = {
          fileName,
          rows: 0,
          accepted: 0,
          rejected: 0,
          errors: ['Only .csv files can be imported.'],
        }
        setImportSummary(summary)
        pushToast({ tone: 'error', title: 'Unsupported file', description: summary.errors[0] })
        return summary
      }
      if (file.size > MAX_IMPORT_BYTES) {
        logSecurityEvent('import.blocked', `File ${fileName} exceeds the import size limit.`)
        const summary: ImportSummary = {
          fileName,
          rows: 0,
          accepted: 0,
          rejected: 0,
          errors: [`File exceeds the ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB import limit.`],
        }
        setImportSummary(summary)
        pushToast({ tone: 'error', title: 'File too large', description: summary.errors[0] })
        return summary
      }
      const text = await file.text()
      const result = importOpportunitiesCsv(text, fileName, dataset.destinations, dataset.suppliers)
      setImportSummary(result.summary)
      if (result.opportunities.length > 0) {
        setImported((current) => {
          const next = [...result.opportunities, ...current]
          writeJson(KEYS.imported, next)
          return next
        })
        logSecurityEvent('import.completed', `${result.opportunities.length} accepted, ${result.summary.rejected} rejected from ${fileName}.`)
        pushToast({
          tone: 'success',
          title: `${result.opportunities.length} opportunities imported`,
          description: result.summary.rejected > 0 ? `${result.summary.rejected} rows were rejected. Review the import summary.` : 'All rows passed validation.',
        })
      } else {
        logSecurityEvent('import.blocked', `No valid rows in ${fileName}.`)
        pushToast({
          tone: 'error',
          title: 'Import failed',
          description: result.summary.errors[0] ?? 'No valid rows were found in the file.',
        })
      }
      return result.summary
    },
    [dataset.destinations, dataset.suppliers, pushToast, logSecurityEvent],
  )

  const clearImported = useCallback(() => {
    setImported([])
    setImportSummary(null)
    writeJson(KEYS.imported, [])
    pushToast({ tone: 'info', title: 'Imported rows removed', description: 'The sample dataset has been restored.' })
  }, [pushToast])

  const resetDemo = useCallback(() => {
    Object.entries(KEYS).forEach(([name, key]) => {
      if (name === 'securityLog') return
      window.localStorage.removeItem(key)
    })
    window.location.hash = '#/overview'
    const actor = profileRef.current.name
    void appendSecurityEvent(securityLogRef.current, { event: 'workspace.reset', detail: 'Plan, decisions, profile and imported rows cleared.', actor })
      .then((next) => {
        securityLogRef.current = next
        setSecurityLog(next)
      })
      .catch(() => undefined)
      .finally(() => window.location.reload())
  }, [])

  // Keep a mirror of the current profile for effect callbacks and lock logic.
  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  // Keep a mirror of the security log for append paths.
  useEffect(() => {
    securityLogRef.current = securityLog
  }, [securityLog])

  // Idle auto-lock: a privileged session drops to the least-privileged role after 15 minutes of inactivity.
  useEffect(() => {
    const markActivity = () => {
      const now = Date.now()
      if (now - lastActivityRef.current > 5_000) lastActivityRef.current = now
    }
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove']
    events.forEach((name) => window.addEventListener(name, markActivity, { passive: true }))
    const interval = window.setInterval(() => {
      if (sessionLockedRef.current) return
      if (!isPrivilegedRole(profileRef.current.role)) return
      if (Date.now() - lastActivityRef.current >= IDLE_LOCK_MS) {
        lockSession('No activity for 15 minutes while holding a privileged role.')
      }
    }, 30_000)
    return () => {
      events.forEach((name) => window.removeEventListener(name, markActivity))
      window.clearInterval(interval)
    }
  }, [lockSession])

  // Seal any records saved before integrity fields existed, then verify on every change.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const sealed = await sealDecisionStore(decisionsRef.current)
      if (cancelled || !sealed.changed) return
      decisionsRef.current = sealed.decisions
      setDecisions(sealed.decisions)
      writeJson(KEYS.decisions, sealed.decisions)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Verify the security log on every change.
  useEffect(() => {
    let cancelled = false
    void verifySecurityLog(securityLog).then((result) => {
      if (!cancelled) setSecurityAudit(result)
    })
    return () => {
      cancelled = true
    }
  }, [securityLog])

  useEffect(() => {
    let cancelled = false
    void verifyDecisionChain(decisions).then((result) => {
      if (!cancelled) setAudit(result)
    })
    return () => {
      cancelled = true
    }
  }, [decisions])

  // Seed a small decision history once, so the review workflow has realistic content.
  useEffect(() => {
    if (seededRef.current || recommendations.length === 0) return
    seededRef.current = true
    if (window.localStorage.getItem(KEYS.seeded)) return
    const committed = recommendations.filter((rec) => rec.kind === 'commitment').slice(0, SEED_NOTES.length)
    const seed: Record<string, Decision> = {}
    committed.forEach((rec, index) => {
      seed[rec.id] = {
        status: SEED_NOTES[index].status,
        note: SEED_NOTES[index].note,
        user: 'A. Sharma',
        userRole: 'Approver',
        at: `2026-11-${String(10 + index).padStart(2, '0')} · 11:${String(20 + index * 5).padStart(2, '0')}`,
      }
    })
    if (Object.keys(seed).length === 0) return
    window.localStorage.setItem(KEYS.seeded, 'true')
    void (async () => {
      const sealed = await sealDecisionStore(seed)
      setDecisions((current) => {
        const next = { ...sealed.decisions, ...current }
        decisionsRef.current = next
        writeJson(KEYS.decisions, next)
        return next
      })
    })()
  }, [recommendations])

  const value: AppContextValue = {
    dataset,
    opportunities,
    imported,
    importSummary,
    plan,
    setPlan,
    optimizer,
    baselinePlan,
    baseline,
    recommendations,
    completed,
    decisions,
    audit,
    decide,
    resetDecision,
    runOptimisation,
    profile,
    setProfile,
    sessionLocked,
    effectiveRole: sessionLocked ? DEFAULT_ROLE : profile.role,
    lockSession,
    unlockSession,
    securityLog,
    securityAudit,
    logSecurityEvent,
    fmt,
    destName,
    supplierName,
    opportunityLabel,
    toasts,
    pushToast,
    dismissToast,
    importFile,
    clearImported,
    resetDemo,
    lastRunAt,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
