import type { Decision } from '../types'

export const GENESIS_HASH = '0'.repeat(64)

export type AuditStatus = 'verified' | 'invalid' | 'empty' | 'unavailable'

export interface AuditVerification {
  status: AuditStatus
  checked: number
  invalidIds: string[]
  message: string
}

export function isIntegrityAvailable(): boolean {
  return typeof globalThis !== 'undefined' && !!globalThis.crypto?.subtle
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Hash the decision content together with its record id and the preceding chain hash. */
export async function hashDecision(decision: Decision, id: string): Promise<string> {
  const payload = {
    id,
    status: decision.status,
    note: decision.note ?? '',
    user: decision.user ?? '',
    userRole: decision.userRole ?? '',
    at: decision.at ?? '',
    previousHash: decision.previousHash ?? GENESIS_HASH,
  }
  return sha256Hex(stableStringify(payload))
}

export function getLastDecisionHash(decisions: Record<string, Decision>): string {
  const entries = Object.entries(decisions)
  if (entries.length === 0) return GENESIS_HASH
  return entries[entries.length - 1][1].hash ?? GENESIS_HASH
}

/** Seal any legacy or newly seeded records that do not yet carry an integrity hash. */
export async function sealDecisionStore(
  decisions: Record<string, Decision>,
): Promise<{ decisions: Record<string, Decision>; changed: boolean }> {
  if (!isIntegrityAvailable()) return { decisions, changed: false }

  const sealed: Record<string, Decision> = {}
  let previous = GENESIS_HASH
  let changed = false

  for (const [id, decision] of Object.entries(decisions)) {
    const previousHash = decision.previousHash ?? previous
    const hash = decision.hash ?? (await hashDecision({ ...decision, previousHash }, id))
    sealed[id] = { ...decision, previousHash, hash }
    if (decision.hash !== hash || decision.previousHash !== previousHash) changed = true
    previous = hash
  }

  return { decisions: sealed, changed }
}

/** Verify both the hash of every record and the links between records. */
export async function verifyDecisionChain(decisions: Record<string, Decision>): Promise<AuditVerification> {
  const entries = Object.entries(decisions)
  const base = { checked: entries.length, invalidIds: [] as string[] }

  if (entries.length === 0) {
    return { status: 'empty', ...base, message: 'No decisions have been recorded yet.' }
  }
  if (!isIntegrityAvailable()) {
    return {
      status: 'unavailable',
      ...base,
      message: 'Secure browser context unavailable. Open the app over HTTPS to enable audit hashing.',
    }
  }

  const invalidIds: string[] = []
  let previous = GENESIS_HASH

  for (const [id, decision] of entries) {
    if ((decision.previousHash ?? GENESIS_HASH) !== previous && !invalidIds.includes(id)) {
      invalidIds.push(id)
    }
    const expectedHash = await hashDecision(decision, id)
    if (decision.hash !== expectedHash && !invalidIds.includes(id)) {
      invalidIds.push(id)
    }
    previous = decision.hash ?? expectedHash
  }

  if (invalidIds.length > 0) {
    return {
      status: 'invalid',
      checked: entries.length,
      invalidIds,
      message: `${invalidIds.length} audit record${invalidIds.length === 1 ? '' : 's'} failed verification and may have been changed.`,
    }
  }

  return {
    status: 'verified',
    checked: entries.length,
    invalidIds: [],
    message: `${entries.length} decision${entries.length === 1 ? '' : 's'} verified in an unbroken SHA-256 chain.`,
  }
}
