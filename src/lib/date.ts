const MS_DAY = 86400000

export const TODAY_ISO = '2026-11-16'

export function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(parseIso(iso).getTime() + days * MS_DAY))
}

export function startOfWeek(iso: string): string {
  const date = parseIso(iso)
  const day = date.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  return toIso(new Date(date.getTime() + diff * MS_DAY))
}

export function weekEnd(startIso: string): string {
  return addDays(startIso, 6)
}

export function weeksBetween(fromIso: string, toIsoValue: string): number {
  return Math.round((parseIso(toIsoValue).getTime() - parseIso(fromIso).getTime()) / (7 * MS_DAY))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatWeekRange(startIso: string): string {
  const start = parseIso(startIso)
  const end = parseIso(weekEnd(startIso))
  const sameMonth = start.getUTCMonth() === end.getUTCMonth()
  const startLabel = `${start.getUTCDate()}${sameMonth ? '' : ` ${MONTHS[start.getUTCMonth()]}`}`
  const endLabel = `${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`
  return `${startLabel} – ${endLabel}`
}

export function formatDate(iso: string): string {
  const d = parseIso(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function formatShortDate(iso: string): string {
  const d = parseIso(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  return `${MONTHS[Number(month) - 1]} ${year.slice(2)}`
}

export function monthIndex(iso: string): number {
  return parseIso(iso).getUTCMonth()
}

export function todayLabel(): string {
  return formatDate(TODAY_ISO)
}
