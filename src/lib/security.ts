import type { CategoryId, DecisionStatus, PlanConfig, Profile } from '../types'
import { CATEGORIES } from '../data/categories'

export const ROLES: Profile['role'][] = ['Inventory Analyst', 'Approver', 'Admin']
export const DEFAULT_ROLE: Profile['role'] = 'Inventory Analyst'
export const APPROVAL_ROLES: Profile['role'][] = ['Approver', 'Admin']
export const PRIVILEGED_ROLES = APPROVAL_ROLES

/** A privileged session locks itself after this much inactivity and drops to the least-privileged role. */
export const IDLE_LOCK_MS = 15 * 60_000
export const NAME_MAX_LENGTH = 48
export const NOTE_MAX_LENGTH = 1200

export function isPrivilegedRole(role: Profile['role']): boolean {
  return APPROVAL_ROLES.includes(role)
}

export function canRecordDecision(role: Profile['role'], status: DecisionStatus): boolean {
  if (status === 'Approved' || status === 'Rejected') return APPROVAL_ROLES.includes(role)
  return true
}

export function sanitizeNote(value?: string, maxLength = NOTE_MAX_LENGTH): string | undefined {
  if (!value) return undefined
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
  return cleaned || undefined
}

export function safeLabel(value: string | undefined | null, maxLength = 48): string {
  const cleaned = (value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  if (!cleaned) return '—'
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned
}

/** Display names are user-controlled: strip control characters, collapse whitespace and cap the length. */
export function sanitizeName(value: unknown, maxLength = NAME_MAX_LENGTH): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function isRole(value: unknown): value is Profile['role'] {
  return typeof value === 'string' && (ROLES as string[]).includes(value)
}

/** Rebuild a profile from untrusted storage, falling back to the least-privileged shape. */
export function sanitizeProfile(raw: unknown, fallback: Profile): Profile {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const name = sanitizeName(source.name)
  return {
    name: name || fallback.name,
    role: isRole(source.role) ? source.role : fallback.role,
  }
}

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((category) => category.id))
const HORIZON_OPTIONS = [8, 12, 16]
const RISK_OPTIONS = ['Conservative', 'Balanced', 'Growth']
const CURRENCY_OPTIONS = ['INR', 'USD']

function boundedNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(max, Math.max(min, value))
}

/**
 * Validate a plan patch read from storage. Unknown keys and out-of-range values are
 * dropped so a tampered localStorage entry cannot feed NaN, Infinity or bogus enums
 * into the optimiser.
 */
export function sanitizePlanPatch(raw: unknown): Partial<PlanConfig> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const patch: Partial<PlanConfig> = {}

  const budget = boundedNumber(source.budget, 1_000, 10_000_000_000)
  if (budget !== null) patch.budget = Math.round(budget)

  if (typeof source.currency === 'string' && CURRENCY_OPTIONS.includes(source.currency)) {
    patch.currency = source.currency as PlanConfig['currency']
  }

  if (typeof source.horizonWeeks === 'number' && HORIZON_OPTIONS.includes(source.horizonWeeks)) {
    patch.horizonWeeks = source.horizonWeeks
  }

  if (Array.isArray(source.categories)) {
    const categories = [...new Set(source.categories.filter((id): id is CategoryId => typeof id === 'string' && CATEGORY_IDS.has(id)))]
    if (categories.length > 0) patch.categories = categories
  }

  const reservePct = boundedNumber(source.reservePct, 0, 60)
  if (reservePct !== null) patch.reservePct = reservePct

  const supplierCapPct = boundedNumber(source.supplierCapPct, 0, 100)
  if (supplierCapPct !== null) patch.supplierCapPct = supplierCapPct

  if (typeof source.risk === 'string' && RISK_OPTIONS.includes(source.risk)) {
    patch.risk = source.risk as PlanConfig['risk']
  }

  if (source.categoryCaps && typeof source.categoryCaps === 'object' && !Array.isArray(source.categoryCaps)) {
    const caps: Partial<Record<CategoryId, number>> = {}
    for (const [key, value] of Object.entries(source.categoryCaps as Record<string, unknown>)) {
      if (!CATEGORY_IDS.has(key)) continue
      const cap = boundedNumber(value, 0, 10_000_000_000)
      if (cap !== null) caps[key as CategoryId] = cap
    }
    patch.categoryCaps = caps
  }

  return patch
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_PARSE_DEPTH = 6
const MAX_PARSE_ENTRIES = 5000
const MAX_PARSE_BYTES = 512 * 1024

/** Recursively drop prototype-pollution keys, functions and symbols from parsed JSON. */
function sanitizeParsed(value: unknown, depth = 0): unknown {
  if (value === null) return null
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') return value
  if (depth >= MAX_PARSE_DEPTH) return undefined
  if (Array.isArray(value)) {
    return value.slice(0, MAX_PARSE_ENTRIES).map((entry) => sanitizeParsed(entry, depth + 1)).filter((entry) => entry !== undefined)
  }
  if (type === 'object') {
    const clean: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (UNSAFE_KEYS.has(key)) continue
      const cleanEntry = sanitizeParsed(entry, depth + 1)
      if (cleanEntry !== undefined) clean[key] = cleanEntry
    }
    return clean
  }
  return undefined
}

/** JSON.parse with size limits, depth limits and prototype-pollution key stripping. */
export function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || raw.length > MAX_PARSE_BYTES) return fallback
  try {
    const parsed = sanitizeParsed(JSON.parse(raw)) as T | undefined
    return parsed === undefined || parsed === null ? fallback : parsed
  } catch {
    return fallback
  }
}

// --- Sliding-window rate limiting for sensitive actions (per browser session). ---

const RATE_BUCKETS = new Map<string, number[]>()

/**
 * Returns true when an action under `bucket` may proceed. Callers enforce limits such as
 * 10 decisions, 6 profile saves or 5 imports per minute to blunt runaway or scripted input.
 */
export function allowAction(bucket: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const hits = (RATE_BUCKETS.get(bucket) ?? []).filter((at) => now - at < windowMs)
  if (hits.length >= limit) {
    RATE_BUCKETS.set(bucket, hits)
    return false
  }
  hits.push(now)
  RATE_BUCKETS.set(bucket, hits)
  return true
}

// --- Runtime security posture checks surfaced on the Settings page. ---

export type PostureState = 'pass' | 'warn' | 'fail'

export interface PostureCheck {
  id: string
  label: string
  detail: string
  state: PostureState
}

function checkSecureContext(): PostureCheck {
  const secure = typeof window !== 'undefined' && window.isSecureContext
  return {
    id: 'secure-context',
    label: 'Secure context (HTTPS)',
    detail: secure
      ? 'Served over HTTPS; Web Crypto audit hashing is available.'
      : 'Not a secure context. Open the app over HTTPS so decisions can be SHA-256 sealed.',
    state: secure ? 'pass' : 'fail',
  }
}

function checkCsp(): PostureCheck {
  const hasMeta = typeof document !== 'undefined' && !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')
  return {
    id: 'csp',
    label: 'Content-Security-Policy',
    detail: hasMeta
      ? 'A CSP meta tag ships with the page; the deployed host also sends a CSP header (see vercel.json).'
      : 'No CSP meta tag found. Deployment headers in vercel.json still enforce one on Vercel.',
    state: hasMeta ? 'pass' : 'warn',
  }
}

function checkWebCrypto(): PostureCheck {
  const available = isCryptoAvailable()
  return {
    id: 'web-crypto',
    label: 'Web Crypto (SHA-256)',
    detail: available
      ? 'Decision and security-event records can be hashed and chained.'
      : 'Secure browser context unavailable; audit sealing is disabled.',
    state: available ? 'pass' : 'fail',
  }
}

function checkStorage(): PostureCheck {
  let state: PostureState = 'pass'
  let detail = 'Plan, decisions and the security log persist in this browser only.'
  try {
    const probe = 'tbo.probe.v1'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
  } catch {
    state = 'warn'
    detail = 'Local storage is blocked (private mode or policy); settings will not persist.'
  }
  return { id: 'storage', label: 'Browser storage', detail, state }
}

async function checkPermissionsPolicy(): Promise<PostureCheck> {
  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
    const blocked = result.state === 'denied'
    return {
      id: 'permissions',
      label: 'Permissions-Policy',
      detail: blocked
        ? 'Sensors and camera are denied by policy; the deployment also ships a restrictive Permissions-Policy header.'
        : 'The browser has not denied camera access; the deployment header still disables it for this origin.',
      state: blocked ? 'pass' : 'warn',
    }
  } catch {
    return {
      id: 'permissions',
      label: 'Permissions-Policy',
      detail: 'This browser does not expose permission queries; rely on the deployment headers in vercel.json.',
      state: 'warn',
    }
  }
}

function checkBuild(): PostureCheck {
  const dev = import.meta.env.DEV
  return {
    id: 'build',
    label: 'Build mode',
    detail: dev
      ? 'Development build — relaxed CSP for hot reload. Do not record real decisions here.'
      : 'Production build with the strict content-security policy.',
    state: dev ? 'warn' : 'pass',
  }
}

export function isCryptoAvailable(): boolean {
  return typeof globalThis !== 'undefined' && !!globalThis.crypto?.subtle
}

export async function securityPosture(): Promise<PostureCheck[]> {
  return [
    checkSecureContext(),
    checkCsp(),
    checkWebCrypto(),
    checkStorage(),
    await checkPermissionsPolicy(),
    checkBuild(),
  ]
}
