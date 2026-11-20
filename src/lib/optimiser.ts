import type {
  AllocationLine,
  CategoryAllocation,
  CategoryId,
  Decision,
  OptimizerResult,
  Opportunity,
  PlanConfig,
  Recommendation,
  RiskProfile,
  Tranche,
} from '../types'
import { CATEGORIES, CATEGORY_MAP } from '../data/categories'
import { clamp } from '../data/rng'
import { formatWeekRange } from './date'

export const RISK_PRESETS: Record<RiskProfile, { tiers: Tranche[]; capture: number; accessPct: number; note: string }> = {
  Conservative: {
    tiers: [1],
    capture: 0.62,
    accessPct: 6,
    note: 'Only high-confidence demand tranches, 20% reserve.',
  },
  Balanced: {
    tiers: [1, 2],
    capture: 0.76,
    accessPct: 8,
    note: 'High-confidence and expected demand, 15% reserve.',
  },
  Growth: {
    tiers: [1, 2, 3],
    capture: 0.88,
    accessPct: 10,
    note: 'Includes speculative tranches, 8% reserve.',
  },
}

export const DEFAULT_PLAN: PlanConfig = {
  budget: 10000000,
  currency: 'INR',
  horizonWeeks: 16,
  categories: CATEGORIES.map((c) => c.id),
  reservePct: 15,
  supplierCapPct: 20,
  risk: 'Balanced',
  categoryCaps: {},
}

const TIER_SELL_PROBABILITY: Record<Tranche, number> = { 1: 0.95, 2: 0.7, 3: 0.38 }

interface Block {
  opportunityId: string
  supplierId: string
  tier: Tranche
  quantity: number
  unitCost: number
  evPerUnit: number
  sellProbability: number
  rigidFactor: number
}

function tierQuantities(opportunity: Opportunity, capture: number): Record<Tranche, number> {
  const high = Math.max(0, opportunity.forecastLow - opportunity.reliableSupply) * capture
  const expected = Math.max(0, opportunity.forecast - opportunity.reliableSupply) * capture
  const speculative = Math.max(0, opportunity.forecastHigh - opportunity.reliableSupply) * capture
  return {
    1: Math.floor(high),
    2: Math.max(0, Math.floor(expected) - Math.floor(high)),
    3: Math.max(0, Math.floor(speculative) - Math.floor(expected)),
  }
}

function supplierScore(rate: number, reliability: number) {
  return rate / Math.max(0.4, reliability)
}

export function optimise(opportunities: Opportunity[], plan: PlanConfig): OptimizerResult {
  const preset = RISK_PRESETS[plan.risk]
  const budget = Math.max(0, plan.budget)
  const reserve = Math.round((budget * plan.reservePct) / 100)
  const accessBudget = Math.round((budget * preset.accessPct) / 100)
  const spendable = Math.max(0, budget - reserve - accessBudget)
  const supplierRoom = new Map<string, number>()
  const categoryRoom = new Map<CategoryId, number>()
  const blocks: Block[] = []

  const eligible = opportunities.filter(
    (opportunity) =>
      plan.categories.includes(opportunity.category) &&
      opportunity.weeksOut <= plan.horizonWeeks &&
      CATEGORY_MAP[opportunity.category].decision === 'commit' &&
      opportunity.gap > 0 &&
      opportunity.action !== 'Avoid' &&
      opportunity.action !== 'Monitor',
  )

  for (const opportunity of eligible) {
    const quantities = tierQuantities(opportunity, preset.capture)
    const sortedQuotes = [...opportunity.quotes].sort(
      (a, b) => supplierScore(a.rate, a.reliability) - supplierScore(b.rate, b.reliability),
    )
    const capacityLeft = new Map(sortedQuotes.map((q) => [q.supplierId, q.capacity]))
    const markupRatio = opportunity.contributionPerUnit / Math.max(1, opportunity.bestUnitCost)

    for (const tier of preset.tiers) {
      let remaining = quantities[tier]
      if (remaining <= 0) continue
      for (const quote of sortedQuotes) {
        if (remaining <= 0) break
        const capacity = capacityLeft.get(quote.supplierId) ?? 0
        if (capacity < 1) continue
        const margin = quote.rate * Math.max(0.02, markupRatio)
        const rigidFactor = quote.flexibility === 'high' ? 0.35 : quote.flexibility === 'medium' ? 0.6 : 0.95
        const unsoldLoss = quote.rate * rigidFactor
        const sellProbability = TIER_SELL_PROBABILITY[tier]
        const evPerUnit = sellProbability * margin - (1 - sellProbability) * unsoldLoss
        if (evPerUnit <= 0) continue

        const quantity = Math.min(Math.floor(remaining), Math.floor(capacity))
        if (quantity < 1) continue

        blocks.push({
          opportunityId: opportunity.id,
          supplierId: quote.supplierId,
          tier,
          quantity,
          unitCost: quote.rate,
          evPerUnit,
          sellProbability,
          rigidFactor,
        })
        capacityLeft.set(quote.supplierId, capacity - quantity)
        remaining -= quantity
      }
    }
  }

  blocks.sort((a, b) => b.evPerUnit / b.unitCost - a.evPerUnit / a.unitCost)

  const lineMap = new Map<string, AllocationLine & { expectedSold: number; weightedProb: number }>()
  let allocated = 0

  for (const block of blocks) {
    const key = `${block.opportunityId}|${block.supplierId}`
    const category = opportunities.find((o) => o.id === block.opportunityId)!.category
    const supplierCap = Math.floor((budget * plan.supplierCapPct) / 100)
    const catCap = Math.floor((budget * (plan.categoryCaps[category] ?? 100)) / 100)
    const currentSupplier = supplierRoom.get(block.supplierId) ?? 0
    const currentCategory = categoryRoom.get(category) ?? 0
    const spendLeft = spendable - allocated

    const affordable = Math.floor(spendLeft / block.unitCost)
    const supplierLimit = Math.floor((supplierCap - currentSupplier) / block.unitCost)
    const categoryLimit = Math.floor((catCap - currentCategory) / block.unitCost)
    const quantity = Math.max(0, Math.min(block.quantity, affordable, supplierLimit, categoryLimit))
    if (quantity < 1) continue

    allocated += quantity * block.unitCost
    supplierRoom.set(block.supplierId, currentSupplier + quantity * block.unitCost)
    categoryRoom.set(category, currentCategory + quantity * block.unitCost)

    const existing = lineMap.get(key)
    if (existing) {
      existing.quantity += quantity
      existing.totalCost += quantity * block.unitCost
      existing.expectedContribution += quantity * block.evPerUnit
      existing.expectedSold += quantity * block.sellProbability
      existing.weightedProb += quantity * block.sellProbability
      existing.downsideExposure += quantity * (1 - block.sellProbability) * block.unitCost * block.rigidFactor
      if (!existing.tranches.includes(block.tier)) existing.tranches.push(block.tier)
    } else {
      lineMap.set(key, {
        opportunityId: block.opportunityId,
        supplierId: block.supplierId,
        quantity,
        unitCost: block.unitCost,
        totalCost: quantity * block.unitCost,
        expectedContribution: quantity * block.evPerUnit,
        downsideExposure: quantity * (1 - block.sellProbability) * block.unitCost * block.rigidFactor,
        sellProbability: block.sellProbability,
        tranches: [block.tier],
        expectedSold: quantity * block.sellProbability,
        weightedProb: quantity * block.sellProbability,
      })
    }
  }

  const lines: AllocationLine[] = [...lineMap.values()]
    .map((line) => ({
      opportunityId: line.opportunityId,
      supplierId: line.supplierId,
      quantity: line.quantity,
      unitCost: line.unitCost,
      totalCost: Math.round(line.totalCost),
      expectedContribution: Math.round(line.expectedContribution),
      downsideExposure: Math.round(line.downsideExposure),
      sellProbability: line.weightedProb / line.quantity,
      tranches: line.tranches.sort(),
    }))
    .sort((a, b) => b.expectedContribution - a.expectedContribution)

  const categoryTotals = new Map<CategoryId, CategoryAllocation>()
  for (const line of lines) {
    const opportunity = opportunities.find((o) => o.id === line.opportunityId)
    if (!opportunity) continue
    const current = categoryTotals.get(opportunity.category) ?? {
      category: opportunity.category,
      allocated: 0,
      contribution: 0,
      downside: 0,
      units: 0,
    }
    current.allocated += line.totalCost
    current.contribution += line.expectedContribution
    current.downside += line.downsideExposure
    current.units += line.quantity
    categoryTotals.set(opportunity.category, current)
  }

  const access = opportunities
    .filter(
      (opportunity) =>
        plan.categories.includes(opportunity.category) &&
        CATEGORY_MAP[opportunity.category].decision === 'access' &&
        opportunity.weeksOut <= plan.horizonWeeks &&
        opportunity.gap > 0,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((opportunity) => {
      const best = [...opportunity.quotes].sort((a, b) => supplierScore(a.rate, a.reliability) - supplierScore(b.rate, b.reliability))[0]
      return {
        opportunityId: opportunity.id,
        supplierId: best.supplierId,
        action: opportunity.action,
        reason: `Gap of ${Math.round(opportunity.gap)} ${CATEGORY_MAP[opportunity.category].unit} in ${formatWeekRange(
          opportunity.weekStart,
        )}; keep live access and renegotiate fare content rather than pre-buying seats.`,
      }
    })

  const byCategory: CategoryAllocation[] = [...categoryTotals.values()].map((entry) => ({
    ...entry,
    allocated: Math.round(entry.allocated),
    contribution: Math.round(entry.contribution),
    downside: Math.round(entry.downside),
  }))

  const expectedContribution = Math.round(lines.reduce((sum, line) => sum + line.expectedContribution, 0))
  const downside = Math.round(lines.reduce((sum, line) => sum + line.downsideExposure, 0))

  return {
    lines,
    access,
    allocated: Math.round(allocated),
    reserve,
    unallocated: Math.max(0, Math.round(budget - reserve - accessBudget - allocated)),
    expectedContribution,
    downside,
    byCategory,
    accessBudget,
    fillRate: spendable > 0 ? allocated / spendable : 0,
  }
}

export function buildRecommendations(
  result: OptimizerResult,
  opportunities: Opportunity[],
  decisions: Record<string, Decision>,
): Recommendation[] {
  const byId = new Map(opportunities.map((o) => [o.id, o]))

  const commitments: Recommendation[] = result.lines.map((line) => {
    const opportunity = byId.get(line.opportunityId)!
    const id = `rec-${line.opportunityId}-${line.supplierId}`
    const decision = decisions[id]
    return {
      id,
      kind: 'commitment',
      opportunityId: line.opportunityId,
      supplierId: line.supplierId,
      quantity: line.quantity,
      unitCost: line.unitCost,
      totalCost: line.totalCost,
      expectedContribution: line.expectedContribution,
      downsideExposure: line.downsideExposure,
      action: opportunity.action,
      confidence: opportunity.confidence,
      score: opportunity.score,
      tranches: line.tranches,
      status: decision?.status ?? 'Pending',
      note: decision?.note,
      decidedBy: decision?.user,
      decidedAt: decision?.at,
    }
  })

  const access: Recommendation[] = result.access.map((item) => {
    const opportunity = byId.get(item.opportunityId)!
    const id = `rec-${opportunity.id}-${item.supplierId}`
    const decision = decisions[id]
    return {
      id,
      kind: 'access',
      opportunityId: opportunity.id,
      supplierId: item.supplierId,
      quantity: 0,
      unitCost: 0,
      totalCost: 0,
      expectedContribution: 0,
      downsideExposure: 0,
      action: item.action,
      confidence: opportunity.confidence,
      score: opportunity.score,
      tranches: [1],
      status: decision?.status ?? 'Pending',
      note: decision?.note,
      decidedBy: decision?.user,
      decidedAt: decision?.at,
    }
  })

  return [...commitments, ...access]
}

export function buildCompletedOutcomes(opportunities: Opportunity[]): Recommendation[] {
  const pool = opportunities.filter((o) => o.action === 'Commit allotment').slice(20, 26)
  return pool.slice(0, 4).map((opportunity, index) => {
    const quantity = Math.round(clamp(opportunity.gap * 0.55, 12, 160))
    const sold = Math.round(quantity * [0.91, 0.74, 0.62, 0.95][index])
    const unitCost = opportunity.bestUnitCost
    const profit = Math.round(sold * opportunity.contributionPerUnit - (quantity - sold) * unitCost * 0.45)
    return {
      id: `done-${opportunity.id}`,
      kind: 'commitment' as const,
      opportunityId: opportunity.id,
      supplierId: opportunity.quotes[0].supplierId,
      quantity,
      unitCost,
      totalCost: Math.round(quantity * unitCost),
      expectedContribution: Math.round(quantity * opportunity.contributionPerUnit * 0.8),
      downsideExposure: Math.round((quantity - sold) * unitCost * 0.45),
      action: 'Commit allotment' as const,
      confidence: opportunity.confidence,
      score: opportunity.score,
      tranches: [1, 2] as Tranche[],
      status: 'Completed' as const,
      decidedBy: 'A. Sharma',
      decidedAt: '2026-10-02 11:20',
      realised: {
        sold,
        revenue: Math.round(sold * opportunity.sellPrice),
        profit,
        unsold: quantity - sold,
      },
    }
  })
}

export const CATEGORY_ORDER = CATEGORIES.map((category) => category.id)
