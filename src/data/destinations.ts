import type { Destination } from '../types'

const season = (peakMonths: number[], peak: number, lowMonths: number[], low: number) => {
  const base = Array.from({ length: 12 }, () => 1)
  peakMonths.forEach((m) => (base[m] = peak))
  lowMonths.forEach((m) => (base[m] = low))
  return base
}

export const DESTINATIONS: Destination[] = [
  {
    id: 'jaipur',
    city: 'Jaipur',
    country: 'India',
    region: 'South Asia',
    weight: 1.25,
    priceIndex: 0.85,
    seasonality: season([9, 10, 11, 0, 1, 2], 1.32, [5, 6, 7], 0.82),
  },
  {
    id: 'goa',
    city: 'Goa',
    country: 'India',
    region: 'South Asia',
    weight: 1.3,
    priceIndex: 0.9,
    seasonality: season([10, 11, 0, 1], 1.4, [5, 6, 7], 0.68),
  },
  {
    id: 'dubai',
    city: 'Dubai',
    country: 'UAE',
    region: 'Middle East',
    weight: 1.35,
    priceIndex: 1.25,
    seasonality: season([10, 11, 0, 1, 2], 1.38, [6, 7], 0.72),
  },
  {
    id: 'bangkok',
    city: 'Bangkok',
    country: 'Thailand',
    region: 'South East Asia',
    weight: 1.15,
    priceIndex: 0.75,
    seasonality: season([10, 11, 0, 1], 1.3, [8, 9], 0.85),
  },
  {
    id: 'singapore',
    city: 'Singapore',
    country: 'Singapore',
    region: 'South East Asia',
    weight: 1.05,
    priceIndex: 1.2,
    seasonality: season([5, 6, 7, 11], 1.26, [1, 2], 0.88),
  },
  {
    id: 'london',
    city: 'London',
    country: 'United Kingdom',
    region: 'Europe',
    weight: 1.0,
    priceIndex: 1.6,
    seasonality: season([5, 6, 7], 1.32, [0, 1], 0.8),
  },
  {
    id: 'paris',
    city: 'Paris',
    country: 'France',
    region: 'Europe',
    weight: 0.95,
    priceIndex: 1.55,
    seasonality: season([3, 4, 5, 8], 1.3, [0, 1], 0.82),
  },
  {
    id: 'bali',
    city: 'Bali',
    country: 'Indonesia',
    region: 'South East Asia',
    weight: 1.0,
    priceIndex: 0.8,
    seasonality: season([3, 4, 5, 6, 7, 8, 9], 1.3, [0], 0.85),
  },
  {
    id: 'colombo',
    city: 'Colombo',
    country: 'Sri Lanka',
    region: 'South Asia',
    weight: 0.7,
    priceIndex: 0.7,
    seasonality: season([11, 0, 1, 2], 1.25, [5, 6], 0.85),
  },
  {
    id: 'maldives',
    city: 'Maldives',
    country: 'Maldives',
    region: 'South Asia',
    weight: 0.65,
    priceIndex: 2.1,
    seasonality: season([10, 11, 0, 1, 2, 3], 1.45, [5, 6, 7], 0.75),
  },
  {
    id: 'istanbul',
    city: 'Istanbul',
    country: 'Turkey',
    region: 'Europe',
    weight: 0.8,
    priceIndex: 1.0,
    seasonality: season([3, 4, 5, 8, 9], 1.25, [0, 1], 0.85),
  },
  {
    id: 'newyork',
    city: 'New York',
    country: 'United States',
    region: 'North America',
    weight: 0.75,
    priceIndex: 1.8,
    seasonality: season([4, 5, 6, 9, 10, 11], 1.28, [1, 2], 0.85),
  },
  {
    id: 'tokyo',
    city: 'Tokyo',
    country: 'Japan',
    region: 'North Asia',
    weight: 0.7,
    priceIndex: 1.4,
    seasonality: season([2, 3], 1.35, [5, 6], 0.88),
  },
  {
    id: 'sydney',
    city: 'Sydney',
    country: 'Australia',
    region: 'Oceania',
    weight: 0.6,
    priceIndex: 1.5,
    seasonality: season([11, 0, 1], 1.3, [5, 6], 0.88),
  },
]

export const DESTINATION_MAP = Object.fromEntries(
  DESTINATIONS.map((d) => [d.id, d]),
) as Record<string, Destination>

export interface TravelEvent {
  id: string
  label: string
  date: string
  uplift: number
  scope: 'all' | string
}

export const EVENTS: TravelEvent[] = [
  { id: 'diwali-25', label: 'Diwali travel peak', date: '2025-10-20', uplift: 1.22, scope: 'India' },
  { id: 'xmas-25', label: 'Christmas & New Year', date: '2025-12-22', uplift: 1.3, scope: 'all' },
  { id: 'ny-26', label: 'New Year week', date: '2025-12-29', uplift: 1.26, scope: 'all' },
  { id: 'republic-26', label: 'Republic Day long weekend', date: '2026-01-26', uplift: 1.16, scope: 'India' },
  { id: 'valentine-26', label: "Valentine's weekend", date: '2026-02-09', uplift: 1.12, scope: 'all' },
  { id: 'holi-26', label: 'Holi break', date: '2026-03-02', uplift: 1.18, scope: 'India' },
  { id: 'sakura-26', label: 'Cherry blossom season', date: '2026-03-23', uplift: 1.3, scope: 'Japan' },
  { id: 'easter-26', label: 'Easter holidays', date: '2026-03-30', uplift: 1.16, scope: 'United Kingdom' },
  { id: 'easter-fr-26', label: 'Easter holidays', date: '2026-03-30', uplift: 1.16, scope: 'France' },
  { id: 'summer-26', label: 'European summer peak', date: '2026-06-22', uplift: 1.32, scope: 'United Kingdom' },
  { id: 'summer-fr-26', label: 'European summer peak', date: '2026-06-22', uplift: 1.3, scope: 'France' },
  { id: 'f1-26', label: 'Formula 1 weekend', date: '2026-10-05', uplift: 1.28, scope: 'Singapore' },
  { id: 'nyc-marathon-26', label: 'NYC marathon weekend', date: '2026-11-02', uplift: 1.2, scope: 'United States' },
  { id: 'diwali-26', label: 'Diwali travel peak', date: '2026-11-08', uplift: 1.22, scope: 'India' },
  { id: 'xmas-26', label: 'Christmas & New Year', date: '2026-12-21', uplift: 1.34, scope: 'all' },
  { id: 'ny-27', label: 'New Year week', date: '2026-12-28', uplift: 1.3, scope: 'all' },
  { id: 'republic-27', label: 'Republic Day long weekend', date: '2027-01-25', uplift: 1.16, scope: 'India' },
  { id: 'valentine-27', label: "Valentine's weekend", date: '2027-02-08', uplift: 1.12, scope: 'all' },
]
