import type { CategoryId, Opportunity, WeeklyPoint } from '../types'
import { CATEGORY_MAP } from '../data/categories'
import { addDays, formatShortDate, startOfWeek } from './date'
import { TODAY_ISO } from './date'

export interface DemandPoint {
  label: string
  actual: number | null
  forecast: number | null
  low: number | null
  high: number | null
}

export function demandSeries(
  history: WeeklyPoint[],
  opportunities: Opportunity[],
  categories: CategoryId[],
  actualWeeks = 12,
  forwardWeeks = 8,
): DemandPoint[] {
  const currentWeek = startOfWeek(TODAY_ISO)
  const active = new Set(categories)
  const points: DemandPoint[] = []

  for (let offset = actualWeeks; offset >= 1; offset -= 1) {
    const weekStart = addDays(currentWeek, -offset * 7)
    const total = history
      .filter((row) => row.weekStart === weekStart && active.has(row.category))
      .reduce((sum, row) => sum + row.bookings * CATEGORY_MAP[row.category].unitsPerBooking, 0)
    points.push({
      label: formatShortDate(weekStart),
      actual: Math.round(total),
      forecast: null,
      low: null,
      high: null,
    })
  }

  const lastActual = points[points.length - 1]?.actual ?? 0
  if (points.length > 0) points[points.length - 1].forecast = lastActual

  for (let offset = 1; offset <= forwardWeeks; offset += 1) {
    const weekStart = addDays(currentWeek, offset * 7)
    const rows = opportunities.filter((o) => o.weekStart === weekStart && active.has(o.category))
    const sum = (key: 'forecast' | 'forecastLow' | 'forecastHigh') =>
      Math.round(rows.reduce((total, row) => total + row[key], 0))
    points.push({
      label: formatShortDate(weekStart),
      actual: null,
      forecast: sum('forecast'),
      low: sum('forecastLow'),
      high: sum('forecastHigh'),
    })
  }

  return points
}

export function portfolioSummary(opportunities: Opportunity[], plan: { categories: CategoryId[]; horizonWeeks: number }) {
  const active = opportunities.filter(
    (o) => plan.categories.includes(o.category) && o.weeksOut <= plan.horizonWeeks,
  )
  const forecast = active.reduce((sum, o) => sum + o.forecast, 0)
  const supply = active.reduce((sum, o) => sum + o.reliableSupply, 0)
  const gap = active.reduce((sum, o) => sum + o.gap, 0)
  return {
    forecast: Math.round(forecast),
    supply: Math.round(supply),
    gap: Math.round(gap),
    gapRatio: forecast > 0 ? gap / forecast : 0,
    opportunities: active.filter((o) => o.gap > 0).length,
    highPriority: active.filter((o) => o.priority === 'High').length,
  }
}

export function categoryMix(history: WeeklyPoint[], weeks = 8) {
  const currentWeek = startOfWeek(TODAY_ISO)
  const cutoff = addDays(currentWeek, -weeks * 7)
  const totals = new Map<CategoryId, { bookings: number; revenue: number; searches: number }>()
  for (const row of history) {
    if (row.weekStart < cutoff) continue
    const current = totals.get(row.category) ?? { bookings: 0, revenue: 0, searches: 0 }
    current.bookings += row.bookings
    current.revenue += row.revenue
    current.searches += row.searches
    totals.set(row.category, current)
  }
  return [...totals.entries()]
    .map(([category, value]) => ({
      category,
      ...value,
      ltb: value.bookings > 0 ? value.searches / value.bookings : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function recentLookToBook(history: WeeklyPoint[], weeks = 4): number {
  const currentWeek = startOfWeek(TODAY_ISO)
  const cutoff = addDays(currentWeek, -weeks * 7)
  let searches = 0
  let bookings = 0
  for (const row of history) {
    if (row.weekStart < cutoff) continue
    searches += row.searches
    bookings += row.bookings
  }
  return bookings > 0 ? searches / bookings : 0
}

export function overallCancellationRate(history: WeeklyPoint[], weeks = 8): number {
  const currentWeek = startOfWeek(TODAY_ISO)
  const cutoff = addDays(currentWeek, -weeks * 7)
  let cancellations = 0
  let bookings = 0
  for (const row of history) {
    if (row.weekStart < cutoff) continue
    cancellations += row.cancellations
    bookings += row.bookings
  }
  return bookings > 0 ? cancellations / bookings : 0
}

export function soldOutRate(history: WeeklyPoint[], weeks = 8): number {
  const currentWeek = startOfWeek(TODAY_ISO)
  const cutoff = addDays(currentWeek, -weeks * 7)
  let soldouts = 0
  let searches = 0
  for (const row of history) {
    if (row.weekStart < cutoff) continue
    soldouts += row.soldouts
    searches += row.searches
  }
  return searches > 0 ? soldouts / searches : 0
}
