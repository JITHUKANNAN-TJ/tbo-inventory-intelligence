import type {
  CategoryId,
  Destination,
  Dataset,
  Flexibility,
  Opportunity,
  OpportunityInput,
  Supplier,
  SupplierQuote,
  WeeklyPoint,
} from '../types'
import { CATEGORIES, CATEGORY_MAP } from './categories'
import { DESTINATIONS, EVENTS, type TravelEvent } from './destinations'
import { TODAY_ISO, addDays, monthIndex, parseIso, startOfWeek, toIso, weekEnd } from '../lib/date'
import { between, clamp, gaussian, mulberry32, pickMany, round } from './rng'
import { scoreOpportunities } from '../lib/scoring'

const HISTORY_WEEKS = 104
const FORWARD_WEEKS = 16
const SEED = 20261117

interface SupplierSeed {
  name: string
  category: CategoryId
  tier: Supplier['tier']
  reliability: number
  failureRate: number
  flexibility: Flexibility
  rateFactor: number
  responseHours: number
  coverage: number | 'all'
}

const SUPPLIER_SEEDS: SupplierSeed[] = [
  { name: 'Sterling Resorts Direct', category: 'hotel', tier: 'Premium', reliability: 0.97, failureRate: 0.02, flexibility: 'high', rateFactor: 1.12, responseHours: 3, coverage: 'all' },
  { name: 'Platinum Stays Collection', category: 'hotel', tier: 'Premium', reliability: 0.95, failureRate: 0.03, flexibility: 'medium', rateFactor: 1.18, responseHours: 5, coverage: 8 },
  { name: 'Jumbonline Connect', category: 'hotel', tier: 'Standard', reliability: 0.9, failureRate: 0.07, flexibility: 'medium', rateFactor: 0.94, responseHours: 8, coverage: 'all' },
  { name: 'Coastal Escapes DMC', category: 'hotel', tier: 'Standard', reliability: 0.87, failureRate: 0.09, flexibility: 'high', rateFactor: 0.89, responseHours: 14, coverage: 6 },
  { name: 'Urban Keys Inventory', category: 'hotel', tier: 'Value', reliability: 0.82, failureRate: 0.14, flexibility: 'low', rateFactor: 0.83, responseHours: 24, coverage: 7 },
  { name: 'Alpine Homestays Network', category: 'hotel', tier: 'Value', reliability: 0.85, failureRate: 0.11, flexibility: 'medium', rateFactor: 0.86, responseHours: 19, coverage: 5 },
  { name: 'SkyBridge GDS', category: 'flight', tier: 'Premium', reliability: 0.96, failureRate: 0.03, flexibility: 'high', rateFactor: 1.04, responseHours: 2, coverage: 'all' },
  { name: 'AeroNDC Direct', category: 'flight', tier: 'Premium', reliability: 0.94, failureRate: 0.04, flexibility: 'high', rateFactor: 1.01, responseHours: 3, coverage: 'all' },
  { name: 'FlyDeal Consolidator', category: 'flight', tier: 'Value', reliability: 0.83, failureRate: 0.13, flexibility: 'low', rateFactor: 0.88, responseHours: 26, coverage: 9 },
  { name: 'GulfConnect Air', category: 'flight', tier: 'Standard', reliability: 0.9, failureRate: 0.07, flexibility: 'medium', rateFactor: 0.95, responseHours: 11, coverage: 7 },
  { name: 'CityRide Transfers', category: 'transfer', tier: 'Standard', reliability: 0.92, failureRate: 0.06, flexibility: 'high', rateFactor: 0.96, responseHours: 6, coverage: 'all' },
  { name: 'AirportLink DMC', category: 'transfer', tier: 'Premium', reliability: 0.95, failureRate: 0.03, flexibility: 'medium', rateFactor: 1.08, responseHours: 4, coverage: 9 },
  { name: 'SwiftGround Mobility', category: 'transfer', tier: 'Value', reliability: 0.84, failureRate: 0.12, flexibility: 'low', rateFactor: 0.86, responseHours: 21, coverage: 6 },
  { name: 'DriveNow Partners', category: 'car', tier: 'Standard', reliability: 0.9, failureRate: 0.07, flexibility: 'high', rateFactor: 0.98, responseHours: 9, coverage: 'all' },
  { name: 'MetroWheels Supply', category: 'car', tier: 'Value', reliability: 0.86, failureRate: 0.1, flexibility: 'medium', rateFactor: 0.89, responseHours: 17, coverage: 8 },
  { name: 'LocalLens Experiences', category: 'experience', tier: 'Standard', reliability: 0.91, failureRate: 0.06, flexibility: 'high', rateFactor: 1.02, responseHours: 7, coverage: 'all' },
  { name: 'AttractionDesk', category: 'experience', tier: 'Value', reliability: 0.84, failureRate: 0.11, flexibility: 'low', rateFactor: 0.87, responseHours: 20, coverage: 8 },
  { name: 'Heritage Walks Co.', category: 'experience', tier: 'Premium', reliability: 0.96, failureRate: 0.03, flexibility: 'medium', rateFactor: 1.14, responseHours: 5, coverage: 6 },
  { name: 'OceanLine Partners', category: 'cruise', tier: 'Premium', reliability: 0.93, failureRate: 0.05, flexibility: 'medium', rateFactor: 1.06, responseHours: 12, coverage: 5 },
  { name: 'BlueHorizon Cruises', category: 'cruise', tier: 'Standard', reliability: 0.88, failureRate: 0.08, flexibility: 'low', rateFactor: 0.94, responseHours: 28, coverage: 4 },
  { name: 'RailRoute Distribution', category: 'rail', tier: 'Standard', reliability: 0.92, failureRate: 0.06, flexibility: 'high', rateFactor: 0.97, responseHours: 8, coverage: 'all' },
  { name: 'EuroRail Connect', category: 'rail', tier: 'Premium', reliability: 0.95, failureRate: 0.04, flexibility: 'medium', rateFactor: 1.09, responseHours: 6, coverage: 6 },
]

function eventFor(weekStart: string, destination: Destination): TravelEvent | undefined {
  const end = weekEnd(weekStart)
  return EVENTS.find((event) => {
    if (event.date < weekStart || event.date > end) return false
    return event.scope === 'all' || event.scope === destination.country
  })
}

function monthLabels(): string[] {
  const labels: string[] = []
  const base = parseIso(TODAY_ISO)
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1))
    labels.push(toIso(date).slice(0, 7))
  }
  return labels
}

function generateSuppliers(rand: () => number): Supplier[] {
  const labels = monthLabels()
  return SUPPLIER_SEEDS.map((seed, index) => {
    const category = CATEGORY_MAP[seed.category]
    const names = seed.coverage === 'all' ? DESTINATIONS.map((d) => d.id) : pickMany(rand, DESTINATIONS, seed.coverage).map((d) => d.id)
    const baseRate = category.avgRate * seed.rateFactor
    const drift = between(rand, -0.07, 0.02)
    return {
      id: `sup-${String(index + 1).padStart(2, '0')}`,
      name: seed.name,
      category: seed.category,
      destinations: names,
      tier: seed.tier,
      reliability: seed.reliability,
      failureRate: seed.failureRate,
      flexibility: seed.flexibility,
      avgRate: round(baseRate, 50),
      responseHours: seed.responseHours,
      lastUpdated: `${TODAY_ISO} ${String(6 + (index % 11)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`,
      rateHistory: labels.map((label, monthIdx) => ({
        month: label,
        rate: round(baseRate * (1 + drift + (monthIdx / 11) * 0.09 + gaussian(rand) * 0.018), 50),
      })),
    }
  })
}

function generateHistory(rand: () => number): WeeklyPoint[] {
  const currentWeek = startOfWeek(TODAY_ISO)
  const firstWeek = addDays(currentWeek, -7 * HISTORY_WEEKS)
  const rows: WeeklyPoint[] = []

  for (let weekOffset = 0; weekOffset < HISTORY_WEEKS; weekOffset += 1) {
    const weekStart = addDays(firstWeek, weekOffset * 7)
    for (const category of CATEGORIES) {
      for (const destination of DESTINATIONS) {
        const seasonality = destination.seasonality[monthIndex(weekStart)]
        const event = eventFor(weekStart, destination)
        const growth = 1 + category.growth * (weekOffset / HISTORY_WEEKS)
        const noise = clamp(0.87 + rand() * 0.26 + gaussian(rand) * 0.045, 0.6, 1.45)
        const bookings = Math.max(
          1,
          Math.round(category.baseDemand * destination.weight * seasonality * (event?.uplift ?? 1) * growth * noise),
        )
        const ltb = category.ltb * clamp(0.8 + rand() * 0.45 + (seasonality > 1.15 ? 0.12 : 0), 0.6, 1.7)
        const searches = Math.round(bookings * ltb)
        const soldoutRate = clamp(
          0.045 + (seasonality > 1.15 ? 0.055 : 0) + (event ? 0.04 : 0) + rand() * 0.09,
          0.01,
          0.32,
        )
        const soldouts = Math.round(searches * soldoutRate)
        const cancellations = Math.round(bookings * category.cancelRate * clamp(0.75 + rand() * 0.5, 0.5, 1.5))
        const sellPrice = category.avgRate * destination.priceIndex * clamp(0.94 + rand() * 0.14, 0.85, 1.18)
        const revenue = Math.round((bookings - cancellations) * sellPrice)
        const cost = Math.round(revenue * (category.costRatio + rand() * 0.025))

        rows.push({
          weekStart,
          category: category.id,
          destinationId: destination.id,
          searches,
          soldouts,
          bookings,
          cancellations,
          revenue,
          cost,
        })
      }
    }
  }
  return rows
}

function generateOpportunities(
  rand: () => number,
  suppliers: Supplier[],
  history: WeeklyPoint[],
  currencyLabel: (value: number) => string,
): Opportunity[] {
  const historyIndex = new Map<string, WeeklyPoint>()
  history.forEach((point) => historyIndex.set(`${point.category}|${point.destinationId}|${point.weekStart}`, point))

  const currentWeek = startOfWeek(TODAY_ISO)
  const raw: OpportunityInput[] = []

  for (let weeksOut = 1; weeksOut <= FORWARD_WEEKS; weeksOut += 1) {
    const weekStart = addDays(currentWeek, weeksOut * 7)
    for (const category of CATEGORIES) {
      for (const destination of DESTINATIONS) {
        const lastYearWeek = addDays(weekStart, -364)
        const lastYear = historyIndex.get(`${category.id}|${destination.id}|${lastYearWeek}`)
        const recent: WeeklyPoint[] = []
        const prior: WeeklyPoint[] = []
        const volatility: WeeklyPoint[] = []
        for (let back = 1; back <= 12; back += 1) {
          const key = `${category.id}|${destination.id}|${addDays(currentWeek, -back * 7)}`
          const point = historyIndex.get(key)
          if (!point) continue
          volatility.push(point)
          if (back <= 4) recent.push(point)
          else if (back <= 8) prior.push(point)
        }

        const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)
        const recentBookings = mean(recent.map((p) => p.bookings)) || category.baseDemand * destination.weight
        const priorBookings = mean(prior.map((p) => p.bookings)) || recentBookings
        const event = eventFor(weekStart, destination)
        const eventLift = event ? 1 + (event.uplift - 1) * 0.55 : 1
        const growthFactor = 1 + category.growth * (weeksOut / 52)
        const baseDemand = 0.55 * (lastYear?.bookings ?? recentBookings) + 0.45 * recentBookings * growthFactor
        const expectedBookings = Math.max(4, baseDemand * eventLift)

        const bookingValues = volatility.map((p) => p.bookings)
        const bookingMean = mean(bookingValues) || expectedBookings
        const variance = mean(bookingValues.map((v) => (v - bookingMean) ** 2))
        const cv = clamp(Math.sqrt(variance) / Math.max(1, bookingMean) + (weeksOut > 8 ? 0.035 : 0), 0.1, 0.42)
        const demandGrowth = clamp(recentBookings / Math.max(1, priorBookings) - 1, -0.35, 0.7)

        const forecast = Math.round(expectedBookings * category.unitsPerBooking)
        const forecastLow = Math.round(forecast * (1 - 0.72 * cv))
        const forecastHigh = Math.round(forecast * (1 + 0.92 * cv))

        const supplyRoll = rand()
        const supplyFactor =
          category.decision === 'access'
            ? between(rand, 0.88, 1.45)
            : supplyRoll < 0.22
              ? between(rand, 0.42, 0.74)
              : supplyRoll < 0.63
                ? between(rand, 0.8, 1.0)
                : between(rand, 1.04, 1.36)
        const rawSupply = Math.max(6, forecast * supplyFactor)

        const categorySuppliers = suppliers.filter((s) => s.category === category.id)
        let available = categorySuppliers.filter((s) => s.destinations.includes(destination.id))
        if (available.length < 2) available = categorySuppliers
        const chosen = pickMany(rand, available, Math.min(4, Math.max(2, available.length)))
        const weights = chosen.map(() => between(rand, 0.65, 1.35))
        const weightSum = weights.reduce((a, b) => a + b, 0)

        const quotes: SupplierQuote[] = chosen.map((supplier, idx) => {
          const releaseDays = category.id === 'cruise' ? Math.round(between(rand, 35, 75)) : Math.round(between(rand, 7, 40))
          return {
            supplierId: supplier.id,
            rate: round(
              supplier.avgRate * destination.priceIndex * between(rand, 0.94, 1.09),
              50,
            ),
            capacity: Math.max(4, Math.round((rawSupply * weights[idx]) / weightSum)),
            reliability: clamp(supplier.reliability + gaussian(rand) * 0.012, 0.7, 0.995),
            flexibility: supplier.flexibility,
            releaseDays,
          }
        })

        const freshness = between(rand, 0.92, 0.995)
        const reliableSupply = Math.max(
          1,
          Math.round(quotes.reduce((sum, q) => sum + q.capacity * q.reliability, 0) * freshness),
        )
        const gap = Math.max(0, forecast - reliableSupply)
        const gapRatio = gap / Math.max(1, forecast)

        const best = quotes.reduce((acc, q) =>
          q.rate / Math.max(0.4, q.reliability) < acc.rate / Math.max(0.4, acc.reliability) ? q : acc,
        )
        const markup = clamp(
          0.12 + gapRatio * 0.13 + (category.decision === 'commit' ? 0.035 : 0) + between(rand, -0.02, 0.03),
          0.08,
          0.34,
        )
        const sellPrice = Math.round(best.rate * (1 + markup))
        const ltb =
          (mean(recent.map((p) => p.searches)) / Math.max(1, mean(recent.map((p) => p.bookings)))) *
          between(rand, 0.92, 1.08)
        const soldoutRate = clamp(
          mean(recent.map((p) => p.soldouts)) / Math.max(1, mean(recent.map((p) => p.searches))) + gapRatio * 0.06,
          0.01,
          0.45,
        )
        const cancellationRisk = clamp(
          category.cancelRate * (1 + (weeksOut - 6) / 45) * between(rand, 0.85, 1.18),
          0.03,
          0.4,
        )
        const confidence = clamp(
          0.94 - cv * 1.25 - (weeksOut > 8 ? 0.035 : 0) + (recent.length === 4 ? 0.03 : 0),
          0.35,
          0.96,
        )

        raw.push({
          id: `opp-${category.id}-${destination.id}-${weekStart}`,
          category: category.id,
          destinationId: destination.id,
          weekStart,
          weeksOut,
          forecast,
          forecastLow,
          forecastHigh,
          reliableSupply,
          gap,
          ltb,
          soldoutRate,
          demandGrowth,
          cancellationRisk,
          confidence,
          sellPrice,
          bestUnitCost: best.rate,
          contributionPerUnit: sellPrice - best.rate,
          quotes,
          eventLabel: event?.label,
        })
      }
    }
  }

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id
  return scoreOpportunities(raw, currencyLabel, supplierName).sort((a, b) => b.score - a.score)
}

export function buildDataset(currencyLabel: (value: number) => string = (v) => `₹${Math.round(v)}`): Dataset {
  const rand = mulberry32(SEED)
  const suppliers = generateSuppliers(rand)
  const history = generateHistory(rand)
  const opportunities = generateOpportunities(rand, suppliers, history, currencyLabel)

  return {
    generatedAt: `${TODAY_ISO} 09:30`,
    seedLabel: `Synthetic demo dataset · seed ${SEED}`,
    destinations: DESTINATIONS,
    suppliers,
    history,
    opportunities,
  }
}
