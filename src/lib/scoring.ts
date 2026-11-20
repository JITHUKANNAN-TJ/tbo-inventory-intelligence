import type { ActionType, Opportunity, OpportunityInput, Priority, ScoreBreakdown } from '../types'
import { CATEGORY_MAP } from '../data/categories'

export const SCORE_WEIGHTS = [
  { key: 'gap', label: 'Availability gap', weight: 0.28, hint: 'Forecast demand not covered by reliable supply.' },
  { key: 'growth', label: 'Demand growth', weight: 0.14, hint: 'Recent 4-week demand versus the previous 4 weeks.' },
  { key: 'conversion', label: 'Search conversion', weight: 0.1, hint: 'Inverse look-to-book: stronger intent scores higher.' },
  { key: 'margin', label: 'Margin per unit', weight: 0.16, hint: 'Expected contribution per unit as a share of selling price.' },
  { key: 'reliability', label: 'Supplier reliability', weight: 0.1, hint: 'Confirmation and fulfilment history of the best quote.' },
  { key: 'resilience', label: 'Cancellation resilience', weight: 0.1, hint: 'Lower cancellation probability scores higher.' },
  { key: 'certainty', label: 'Forecast certainty', weight: 0.12, hint: 'Confidence range width and data quality.' },
] as const

export type ScoreKey = (typeof SCORE_WEIGHTS)[number]['key']

function minMax(values: number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) }
}

function normalise(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0
  if (max - min < 1e-9) return 0.5
  return (value - min) / (max - min)
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export function actionFor(opportunity: OpportunityInput, score: number): ActionType {
  const category = CATEGORY_MAP[opportunity.category]
  const gapRatio = opportunity.gap / Math.max(1, opportunity.forecast)
  const bestFlex = opportunity.quotes.reduce<'high' | 'medium' | 'low'>((acc, quote) => {
    const order = { low: 0, medium: 1, high: 2 }
    return order[quote.flexibility] > order[acc] ? quote.flexibility : acc
  }, 'low')

  if (category.decision === 'access') {
    if (gapRatio > 0.22 && score >= 58) return 'Negotiate access'
    if (gapRatio > 0.05 || score >= 55) return 'Prioritise live supply'
    return 'Monitor'
  }

  if (opportunity.gap <= 0) return 'Monitor'
  if (opportunity.contributionPerUnit <= 0) return 'Avoid'
  if (score >= 68 && bestFlex !== 'low') return 'Commit allotment'
  if (score >= 54) return 'Negotiate allotment'
  if (score >= 46) return 'Monitor'
  return 'Avoid'
}

export function priorityFor(score: number): Priority {
  if (score >= 66) return 'High'
  if (score >= 48) return 'Medium'
  return 'Low'
}

export function rationaleFor(opportunity: Opportunity, supplierName: string, currencyLabel: (v: number) => string): string[] {
  const category = CATEGORY_MAP[opportunity.category]
  const gapRatio = opportunity.gap / Math.max(1, opportunity.forecast)
  const lines: string[] = []

  if (opportunity.gap > 0) {
    lines.push(
      `Forecast demand of ${Math.round(opportunity.forecast)} ${category.unit} exceeds reliable supply by ${Math.round(
        opportunity.gap,
      )} (${(gapRatio * 100).toFixed(0)}% of demand).`,
    )
  } else {
    lines.push(
      `Reliable supply of ${Math.round(opportunity.reliableSupply)} ${category.unit} covers forecast demand, so no purchase is needed.`,
    )
  }

  lines.push(
    `Search interest is ${opportunity.demandGrowth >= 0 ? 'up' : 'down'} ${Math.abs(
      opportunity.demandGrowth * 100,
    ).toFixed(0)}% versus the previous four weeks, with roughly 1 booking per ${opportunity.ltb.toFixed(
      1,
    )} searches.`,
  )

  if (opportunity.soldoutRate > 0.08) {
    lines.push(
      `About ${(opportunity.soldoutRate * 100).toFixed(0)}% of recent availability checks returned no suitable option.`,
    )
  }

  lines.push(
    `Best quote is ${currencyLabel(opportunity.bestUnitCost)} per ${category.unitSingular} from ${supplierName}, leaving ${currencyLabel(
      opportunity.contributionPerUnit,
    )} expected contribution per unit.`,
  )

  if (opportunity.eventLabel) {
    lines.push(`${opportunity.eventLabel} falls in this travel week and is expected to lift demand.`)
  }

  return lines
}

export function scoreOpportunities(
  opportunities: OpportunityInput[],
  currencyLabel: (value: number) => string,
  supplierName: (supplierId: string) => string,
): Opportunity[] {
  if (opportunities.length === 0) return []

  const features = opportunities.map((o) => ({
    gap: clamp01(o.gap / Math.max(1, o.forecast)),
    growth: o.demandGrowth,
    conversion: 1 / Math.max(1, o.ltb),
    margin: clamp01(o.contributionPerUnit / Math.max(1, o.sellPrice)),
    reliability: o.quotes.reduce((best, q) => Math.max(best, q.reliability), 0),
    resilience: clamp01(1 - o.cancellationRisk),
    certainty: clamp01(o.confidence),
  }))

  const ranges = Object.fromEntries(
    Object.keys(features[0]).map((key) => [key, minMax(features.map((f) => f[key as keyof typeof f]))]),
  ) as Record<ScoreKey, { min: number; max: number }>

  // Growth and conversion have structural differences between product categories
  // (transfers grow faster than cruises; cruises have a much higher look-to-book).
  // Ranking them within their own category keeps the portfolio view balanced.
  const perCategory = new Map<string, Record<ScoreKey, { min: number; max: number }>>()
  const categories = [...new Set(opportunities.map((o) => o.category))]
  for (const category of categories) {
    const group = opportunities
      .map((o, index) => ({ o, feature: features[index] }))
      .filter((entry) => entry.o.category === category)
      .map((entry) => entry.feature)
    perCategory.set(
      category,
      Object.fromEntries(
        Object.keys(group[0]).map((key) => [key, minMax(group.map((f) => f[key as keyof typeof f]))]),
      ) as Record<ScoreKey, { min: number; max: number }>,
    )
  }

  const scored: Opportunity[] = opportunities.map((opportunity, index) => {
    const feature = features[index]
    const local = perCategory.get(opportunity.category) ?? ranges
    const breakdown: ScoreBreakdown = {
      gap: clamp01(normalise(feature.gap, ranges.gap.min, ranges.gap.max)),
      growth: clamp01(normalise(feature.growth, local.growth.min, local.growth.max)),
      conversion: clamp01(normalise(feature.conversion, local.conversion.min, local.conversion.max)),
      margin: clamp01(normalise(feature.margin, ranges.margin.min, ranges.margin.max)),
      reliability: clamp01(normalise(feature.reliability, ranges.reliability.min, ranges.reliability.max)),
      resilience: clamp01(normalise(feature.resilience, ranges.resilience.min, ranges.resilience.max)),
      certainty: clamp01(normalise(feature.certainty, ranges.certainty.min, ranges.certainty.max)),
    }

    const score = SCORE_WEIGHTS.reduce((sum, { key, weight }) => sum + breakdown[key] * weight, 0) * 100
    const rounded = Math.round(score * 10) / 10

    return {
      ...opportunity,
      score: rounded,
      scoreBreakdown: breakdown,
      priority: priorityFor(rounded),
      action: actionFor(opportunity, rounded),
      rationale: [],
    }
  })

  return scored.map((opportunity) => {
    const best = opportunity.quotes.reduce(
      (acc, quote) => (quote.rate / Math.max(0.4, quote.reliability) < acc.rate / Math.max(0.4, acc.reliability) ? quote : acc),
      opportunity.quotes[0],
    )
    return {
      ...opportunity,
      rationale: rationaleFor(opportunity, best ? supplierName(best.supplierId) : 'the preferred supplier', currencyLabel),
    }
  })
}
