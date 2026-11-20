import type { AuditVerification } from './integrity'
import type { Decision, Destination, ImportSummary, Opportunity, Recommendation, Supplier, WeeklyPoint } from '../types'
import { CATEGORY_MAP } from '../data/categories'
import { startOfWeek } from '../lib/date'
import { TODAY_ISO } from '../lib/date'
import { clamp } from '../data/rng'
import { scoreOpportunities } from './scoring'
import { money } from './format'
import { safeLabel } from './security'

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024
export const MAX_IMPORT_ROWS = 5000

function escapeCell(value: string | number | undefined | null): string {
  const text = value === undefined || value === null ? '' : String(value)
  // Neutralise spreadsheet formulas in user-controlled text without altering numeric cells.
  const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
}

export function toCsv(rows: Record<string, string | number | undefined | null>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','))
  }
  return lines.join('\n')
}

export function downloadFile(fileName: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function buildHistoryCsv(history: WeeklyPoint[], destinations: Destination[]): string {
  const cityById = new Map(destinations.map((d) => [d.id, d.city]))
  return toCsv(
    history.map((row) => ({
      week_start: row.weekStart,
      category: row.category,
      destination: cityById.get(row.destinationId) ?? row.destinationId,
      searches: row.searches,
      sold_outs: row.soldouts,
      bookings: row.bookings,
      cancellations: row.cancellations,
      revenue_inr: row.revenue,
      supplier_cost_inr: row.cost,
    })),
  )
}

export function buildOpportunitiesCsv(
  opportunities: Opportunity[],
  suppliers: Supplier[],
  destinations: Destination[],
): string {
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]))
  const cityName = new Map(destinations.map((d) => [d.id, d.city]))
  return toCsv(
    opportunities.map((row) => ({
      id: row.id,
      category: row.category,
      destination: cityName.get(row.destinationId) ?? row.destinationId,
      week_start: row.weekStart,
      weeks_out: row.weeksOut,
      forecast_units: row.forecast,
      forecast_low: row.forecastLow,
      forecast_high: row.forecastHigh,
      reliable_supply: row.reliableSupply,
      gap_units: row.gap,
      look_to_book: Number(row.ltb.toFixed(2)),
      sold_out_rate: Number(row.soldoutRate.toFixed(3)),
      cancellation_risk: Number(row.cancellationRisk.toFixed(3)),
      confidence: Number(row.confidence.toFixed(3)),
      unit_cost_inr: row.bestUnitCost,
      sell_price_inr: row.sellPrice,
      best_supplier: supplierName.get(row.quotes[0]?.supplierId ?? '') ?? '',
      opportunity_score: row.score,
      priority: row.priority,
      action: row.action,
    })),
  )
}

export function buildSuppliersCsv(suppliers: Supplier[], destinations: Destination[]): string {
  const cityName = new Map(destinations.map((d) => [d.id, d.city]))
  return toCsv(
    suppliers.map((row) => ({
      supplier_id: row.id,
      supplier: row.name,
      category: row.category,
      tier: row.tier,
      destinations: row.destinations.map((id) => cityName.get(id) ?? id).join(' | '),
      average_rate_inr: row.avgRate,
      reliability: row.reliability,
      failure_rate: row.failureRate,
      flexibility: row.flexibility,
      response_hours: row.responseHours,
      last_updated: row.lastUpdated,
    })),
  )
}

export function buildRecommendationsCsv(
  recommendations: Recommendation[],
  opportunities: Opportunity[],
  suppliers: Supplier[],
): string {
  const opportunityById = new Map(opportunities.map((o) => [o.id, o]))
  const supplierById = new Map(suppliers.map((s) => [s.id, s.name]))
  return toCsv(
    recommendations.map((row) => {
      const opportunity = opportunityById.get(row.opportunityId)
      return {
        recommendation_id: row.id,
        category: opportunity?.category ?? '',
        destination: opportunity?.destinationId ?? '',
        week_start: opportunity?.weekStart ?? '',
        action: row.action,
        supplier: supplierById.get(row.supplierId) ?? row.supplierId,
        quantity: row.quantity,
        unit_cost_inr: row.unitCost,
        total_cost_inr: row.totalCost,
        expected_contribution_inr: row.expectedContribution,
        downside_inr: row.downsideExposure,
        confidence: Number(row.confidence.toFixed(3)),
        status: row.status,
      }
    }),
  )
}

export function buildAuditCsv(
  decisions: Record<string, Decision>,
  recommendations: Recommendation[],
  opportunities: Opportunity[],
  verification: AuditVerification,
): string {
  const recommendationById = new Map(recommendations.map((rec) => [rec.id, rec]))
  const opportunityById = new Map(opportunities.map((opp) => [opp.id, opp]))

  return toCsv(
    Object.entries(decisions).map(([id, decision]) => {
      const rec = recommendationById.get(id)
      const opportunity = rec ? opportunityById.get(rec.opportunityId) : undefined
      const rowIntegrity = verification.invalidIds.includes(id)
        ? 'invalid'
        : verification.status === 'unavailable'
          ? 'unavailable'
          : 'verified'

      return {
        recommendation_id: id,
        category: opportunity ? CATEGORY_MAP[opportunity.category].name : '',
        destination: opportunity?.destinationId ?? '',
        week_start: opportunity?.weekStart ?? '',
        action: rec?.action ?? '',
        status: decision.status,
        decided_by: decision.user ?? '',
        role: decision.userRole ?? '',
        decided_at: decision.at ?? '',
        note: decision.note ?? '',
        previous_hash: decision.previousHash ?? '',
        sha256_hash: decision.hash ?? '',
        integrity: rowIntegrity,
      }
    }),
  )
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const cells: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      cells.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    cells.push(row)
  }

  const nonEmpty = cells.filter((line) => line.some((value) => value.trim() !== ''))
  if (nonEmpty.length === 0) return { headers: [], rows: [] }
  const headers = nonEmpty[0].map((header) => header.trim())
  const rows = nonEmpty.slice(1).map((line) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = (line[index] ?? '').trim()
    })
    return record
  })
  return { headers, rows }
}

const REQUIRED_HEADERS = ['category', 'destination', 'week_start', 'forecast_units', 'reliable_supply']
const MAX_FORECAST = 100000
const MAX_SUPPLY = 200000
const MAX_WEEK_LOOKAHEAD_DAYS = 730

function boundedInteger(raw: string | undefined, min: number, max: number): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null
  const value = Number(raw.trim())
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null
}

function isValidIsoDate(raw: string | undefined): boolean {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false
  const parsed = new Date(`${raw}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw
}

function importFailure(fileName: string, rows: number, errors: string[]): { opportunities: Opportunity[]; summary: ImportSummary } {
  return {
    opportunities: [],
    summary: { fileName: safeLabel(fileName, 120), rows, accepted: 0, rejected: rows, errors: errors.slice(0, 6) },
  }
}

export function importOpportunitiesCsv(
  text: string,
  fileName: string,
  destinations: Destination[],
  suppliers: Supplier[],
): { opportunities: Opportunity[]; summary: ImportSummary } {
  const safeFileName = safeLabel(fileName, 120)
  const bytes = new TextEncoder().encode(text).length
  if (bytes > MAX_IMPORT_BYTES) {
    return importFailure(safeFileName, 0, [`File exceeds the ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB import limit.`])
  }

  const { headers, rows } = parseCsv(text)
  if (rows.length > MAX_IMPORT_ROWS) {
    return importFailure(safeFileName, rows.length, [`File contains ${rows.length.toLocaleString('en-IN')} rows; the limit is ${MAX_IMPORT_ROWS.toLocaleString('en-IN')}.`])
  }

  const errors: string[] = []
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header))
  const duplicateHeaders = headers.filter((header, index) => header && headers.indexOf(header) !== index)
  if (missing.length > 0 || duplicateHeaders.length > 0) {
    const problems = [
      ...(missing.length > 0 ? [`Missing required columns: ${missing.join(', ')}`] : []),
      ...(duplicateHeaders.length > 0 ? [`Duplicate columns: ${[...new Set(duplicateHeaders)].join(', ')}`] : []),
    ]
    return importFailure(safeFileName, rows.length, problems)
  }

  const destinationByKey = new Map<string, Destination>()
  destinations.forEach((d) => {
    destinationByKey.set(d.id.toLowerCase(), d)
    destinationByKey.set(d.city.toLowerCase(), d)
  })

  const categoryByKey = new Map<string, keyof typeof CATEGORY_MAP>()
  ;(Object.keys(CATEGORY_MAP) as (keyof typeof CATEGORY_MAP)[]).forEach((key) => {
    categoryByKey.set(key, key)
    categoryByKey.set(CATEGORY_MAP[key].name.toLowerCase(), key)
    categoryByKey.set(CATEGORY_MAP[key].short.toLowerCase(), key)
  })

  const imported: Opportunity[] = []

  rows.forEach((row, index) => {
    const line = index + 2
    const category = categoryByKey.get((row.category ?? '').trim().toLowerCase())
    const destination = destinationByKey.get((row.destination ?? '').trim().toLowerCase())
    if (!category) {
      errors.push(`Line ${line}: unknown category "${safeLabel(row.category)}".`)
      return
    }
    if (!destination) {
      errors.push(`Line ${line}: unknown destination "${safeLabel(row.destination)}".`)
      return
    }

    const forecast = boundedInteger(row.forecast_units, 1, MAX_FORECAST)
    if (forecast === null) {
      errors.push(`Line ${line}: forecast_units must be a whole number from 1 to ${MAX_FORECAST.toLocaleString('en-IN')}.`)
      return
    }
    const reliableSupply = boundedInteger(row.reliable_supply, 0, MAX_SUPPLY)
    if (reliableSupply === null) {
      errors.push(`Line ${line}: reliable_supply must be a whole number from 0 to ${MAX_SUPPLY.toLocaleString('en-IN')}.`)
      return
    }
    if (!isValidIsoDate(row.week_start)) {
      errors.push(`Line ${line}: week_start must be a valid YYYY-MM-DD date.`)
      return
    }
    const weekStart = startOfWeek(row.week_start!)
    const dayOffset = Math.round(
      (new Date(`${weekStart}T00:00:00Z`).getTime() - new Date(`${TODAY_ISO}T00:00:00Z`).getTime()) / 86400000,
    )
    if (dayOffset < -365 || dayOffset > MAX_WEEK_LOOKAHEAD_DAYS) {
      errors.push(`Line ${line}: week_start is outside the accepted planning window.`)
      return
    }

    const meta = CATEGORY_MAP[category]
    const lowRaw = row.forecast_low?.trim()
    const highRaw = row.forecast_high?.trim()
    const forecastLow = lowRaw ? boundedInteger(lowRaw, 1, MAX_FORECAST) : Math.round(forecast * 0.86)
    const forecastHigh = highRaw ? boundedInteger(highRaw, 1, MAX_FORECAST) : Math.round(forecast * 1.16)
    if (lowRaw && (forecastLow === null || forecastLow > forecast)) {
      errors.push(`Line ${line}: forecast_low must be a positive whole number no greater than forecast_units.`)
      return
    }
    if (highRaw && (forecastHigh === null || forecastHigh < forecast)) {
      errors.push(`Line ${line}: forecast_high must be a positive whole number at least forecast_units.`)
      return
    }
    const ltbRaw = row.look_to_book?.trim()
    const ltbValue = ltbRaw ? Number(ltbRaw) : meta.ltb
    if (ltbRaw && (!Number.isFinite(ltbValue) || ltbValue < 1 || ltbValue > 365)) {
      errors.push('Line ' + line + ': look_to_book must be a number from 1 to 365.')
      return
    }

    const gap = Math.max(0, forecast - reliableSupply)
    const quotes = suppliers
      .filter((supplier) => supplier.category === category && supplier.destinations.includes(destination.id))
      .slice(0, 2)
    const chosen = quotes.length > 0 ? quotes : suppliers.filter((supplier) => supplier.category === category).slice(0, 2)
    const unitCost = Math.round(meta.avgRate * destination.priceIndex)
    const price = Math.round(unitCost * 1.19)
    const weeksOut = Math.max(
      1,
      Math.round((new Date(`${weekStart}T00:00:00Z`).getTime() - new Date(`${TODAY_ISO}T00:00:00Z`).getTime()) / (7 * 86400000)),
    )

    imported.push({
      id: `imp-${Date.now()}-${index}`,
      category,
      destinationId: destination.id,
      weekStart,
      weeksOut,
      forecast,
      forecastLow: forecastLow!,
      forecastHigh: forecastHigh!,
      reliableSupply,
      gap,
      ltb: clamp(ltbValue, 1, 365),
      soldoutRate: clamp(gap / Math.max(1, forecast) * 0.6, 0.01, 0.4),
      demandGrowth: clamp(row.look_to_book ? 0.05 : 0.08, -0.3, 0.6),
      cancellationRisk: clamp(meta.cancelRate, 0.03, 0.4),
      confidence: 0.72,
      sellPrice: price,
      bestUnitCost: unitCost,
      contributionPerUnit: price - unitCost,
      quotes: (chosen.length > 0 ? chosen : []).map((supplier, quoteIndex) => ({
        supplierId: supplier.id,
        rate: Math.round(unitCost * (quoteIndex === 0 ? 1 : 1.03)),
        capacity: Math.max(5, Math.round(reliableSupply / Math.max(1, chosen.length))),
        reliability: supplier.reliability,
        flexibility: supplier.flexibility,
        releaseDays: 21,
      })),
      score: 0,
      scoreBreakdown: { gap: 0, growth: 0, conversion: 0, margin: 0, reliability: 0, resilience: 0, certainty: 0 },
      priority: 'Medium',
      action: gap > 0 ? 'Negotiate allotment' : 'Monitor',
      eventLabel: undefined,
      rationale: ['Imported opportunity from CSV. Review supplier quotes before committing budget.'],
    })
  })

  const scored = scoreOpportunities(
    imported,
    (value) => `₹${Math.round(value)}`,
    (id) => suppliers.find((s) => s.id === id)?.name ?? id,
  )

  return {
    opportunities: scored,
    summary: {
      fileName: safeFileName,
      rows: rows.length,
      accepted: scored.length,
      rejected: rows.length - scored.length,
      errors: errors.slice(0, 6),
    },
  }
}

export function downloadTemplate() {
  const header = 'category,destination,week_start,forecast_units,reliable_supply,forecast_low,forecast_high,look_to_book'
  const sample = [
    'hotel,Jaipur,2026-12-21,420,300,380,470,22',
    'flight,Dubai,2026-12-28,610,640,560,680,14',
    'experience,Bali,2027-01-04,180,120,160,205,19',
  ]
  downloadFile('tbo-opportunity-template.csv', `${header}\n${sample.join('\n')}\n`)
}

export function csvPreviewMoney(value: number): string {
  return money(value, 'INR')
}
