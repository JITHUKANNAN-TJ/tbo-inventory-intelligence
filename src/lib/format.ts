import type { Category, Currency } from '../types'
import { CATEGORY_MAP, INR_PER_USD } from '../data/categories'

export function toCurrency(valueInr: number, currency: Currency): number {
  return currency === 'INR' ? valueInr : valueInr / INR_PER_USD
}

export function money(valueInr: number, currency: Currency = 'INR', compact = true): string {
  const value = toCurrency(valueInr, currency)
  const symbol = currency === 'INR' ? '₹' : '$'
  const abs = Math.abs(value)

  if (!compact) {
    return `${symbol}${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }

  if (currency === 'INR') {
    if (abs >= 1e7) return `${symbol}${(value / 1e7).toFixed(2)} Cr`
    if (abs >= 1e5) return `${symbol}${(value / 1e5).toFixed(1)} L`
    if (abs >= 1e3) return `${symbol}${(value / 1e3).toFixed(1)}K`
    return `${symbol}${value.toFixed(0)}`
  }

  if (abs >= 1e6) return `${symbol}${(value / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${symbol}${(value / 1e3).toFixed(1)}K`
  return `${symbol}${value.toFixed(0)}`
}

export function number(value: number, digits = 0): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}

export function signedPct(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(digits)}%`
}

export function units(quantity: number, category: Category): string {
  return `${number(Math.round(quantity))} ${category.unit}`
}

export function categoryName(id: keyof typeof CATEGORY_MAP): string {
  return CATEGORY_MAP[id].name
}

export function rateLabel(valueInr: number, currency: Currency): string {
  return `${money(valueInr, currency)} / unit`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
