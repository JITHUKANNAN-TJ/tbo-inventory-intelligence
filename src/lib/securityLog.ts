import { GENESIS_HASH, sha256Hex, stableStringify } from './integrity'
import { safeParse, sanitizeName, sanitizeNote } from './security'
import { toCsv } from './csv'

export interface SecurityEvent {
  id: string
  at: string
  event: string
  detail?: string
  actor?: string
  previousHash?: string
  hash?: string
}

export type SecurityLogStatus = 'verified' | 'invalid' | 'empty' | 'unavailable'

export interface SecurityLogVerification {
  status: SecurityLogStatus
  checked: number
  invalidIds: string[]
  message: string
}

export const SECURITY_LOG_KEY = 'tbo.securitylog.v1'
export const MAX_SECURITY_EVENTS = 200

export const SECURITY_EVENT_TYPES = [
  'session.locked',
  'session.unlocked',
  'role.elevated',
  'profile.saved',
  'decision.denied',
  'import.completed',
  'import.blocked',
  'action.rate-limited',
  'workspace.reset',
] as const

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number]

export interface SecurityEventInput {
  event: SecurityEventType | string
  detail?: string
  actor?: string
}

function isSecurityEvent(value: unknown): value is SecurityEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && record.id.length > 0 && typeof record.event === 'string' && record.event.length > 0
}

function persist(events: SecurityEvent[]) {
  try {
    window.localStorage.setItem(SECURITY_LOG_KEY, JSON.stringify(events))
  } catch {
    // Storage quota / privacy mode: the in-memory log still works for this session.
  }
}

export function readSecurityLog(): SecurityEvent[] {
  try {
    const parsed = safeParse<unknown>(window.localStorage.getItem(SECURITY_LOG_KEY), [])
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSecurityEvent).slice(-MAX_SECURITY_EVENTS)
  } catch {
    return []
  }
}

async function hashEvent(event: SecurityEvent): Promise<string> {
  return sha256Hex(
    stableStringify({
      id: event.id,
      at: event.at,
      event: event.event,
      detail: event.detail ?? '',
      actor: event.actor ?? '',
      previousHash: event.previousHash ?? GENESIS_HASH,
    }),
  )
}

/** Rebuild the forward hash chain in array order (used after trimming or on legacy records). */
export async function sealSecurityLog(
  events: SecurityEvent[],
): Promise<{ events: SecurityEvent[]; changed: boolean }> {
  const source = events.slice(-MAX_SECURITY_EVENTS)
  const sealed: SecurityEvent[] = []
  let previous = GENESIS_HASH
  let changed = source.length !== events.length

  for (const event of source) {
    const normalised: SecurityEvent = { ...event, previousHash: previous }
    normalised.hash = await hashEvent(normalised)
    if (event.hash !== normalised.hash || event.previousHash !== normalised.previousHash) changed = true
    sealed.push(normalised)
    previous = normalised.hash as string
  }

  return { events: sealed, changed }
}

/**
 * Append a security event, trim to the cap and re-seal the chain. Returns the new list;
 * callers should keep it in a ref so concurrent appends serialise against the latest state.
 */
export async function appendSecurityEvent(
  current: SecurityEvent[],
  input: SecurityEventInput,
): Promise<SecurityEvent[]> {
  const detail = sanitizeNote(input.detail, 400)
  const event: SecurityEvent = {
    id: `sec-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    at: new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' }),
    event: String(input.event).slice(0, 64),
    detail,
    actor: sanitizeName(input.actor) || undefined,
  }

  const appended = [...current, event].slice(-MAX_SECURITY_EVENTS)
  const sealed = await sealSecurityLog(appended)
  persist(sealed.events)
  return sealed.events
}

export async function verifySecurityLog(events: SecurityEvent[]): Promise<SecurityLogVerification> {
  const base = { checked: events.length, invalidIds: [] as string[] }

  if (events.length === 0) {
    return { status: 'empty', ...base, message: 'No security events recorded yet.' }
  }
  if (typeof globalThis === 'undefined' || !globalThis.crypto?.subtle) {
    return {
      status: 'unavailable',
      ...base,
      message: 'Secure browser context unavailable. Open the app over HTTPS to verify the security log.',
    }
  }

  const invalidIds: string[] = []
  let previous = GENESIS_HASH

  for (const event of events) {
    if ((event.previousHash ?? GENESIS_HASH) !== previous && !invalidIds.includes(event.id)) {
      invalidIds.push(event.id)
    }
    const expectedHash = await hashEvent({ ...event, previousHash: event.previousHash ?? previous })
    if (event.hash !== expectedHash && !invalidIds.includes(event.id)) {
      invalidIds.push(event.id)
    }
    previous = event.hash ?? expectedHash
  }

  if (invalidIds.length > 0) {
    return {
      status: 'invalid',
      checked: events.length,
      invalidIds,
      message: `${invalidIds.length} security event${invalidIds.length === 1 ? '' : 's'} failed verification and may have been changed.`,
    }
  }

  return {
    status: 'verified',
    checked: events.length,
    invalidIds: [],
    message: `${events.length} security event${events.length === 1 ? '' : 's'} verified in an unbroken SHA-256 chain.`,
  }
}

export function buildSecurityLogCsv(events: SecurityEvent[]): string {
  return toCsv(
    events.map((event) => ({
      at: event.at,
      event: event.event,
      detail: event.detail ?? '',
      actor: event.actor ?? '',
      previous_hash: event.previousHash ?? '',
      sha256_hash: event.hash ?? '',
    })),
  )
}
