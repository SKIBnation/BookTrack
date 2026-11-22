import { DateTime } from 'luxon'

export function todayKey(zone: string, now = DateTime.now()): string {
  const zoned = now.setZone(zone)
  const picked = zoned.isValid ? zoned : now
  return picked.toISODate() ?? '1970-01-01'
}

export function shiftDate(date: string, days: number): string {
  const next = DateTime.fromISO(date).plus({ days })
  return next.isValid ? (next.toISODate() ?? date) : date
}

export function dayHeading(date: string, today: string): { title: string; detail: string } {
  const parsed = DateTime.fromISO(date)
  if (!parsed.isValid) return { title: date, detail: '' }
  const tomorrow = shiftDate(today, 1)
  const yesterday = shiftDate(today, -1)
  if (date === today || date === tomorrow || date === yesterday) {
    const title = date === today ? 'Today' : date === tomorrow ? 'Tomorrow' : 'Yesterday'
    return { title, detail: parsed.toFormat('cccc d LLLL') }
  }
  const todayYear = DateTime.fromISO(today).year
  return {
    title: parsed.toFormat('cccc d LLL'),
    detail: parsed.year !== todayYear ? String(parsed.year) : '',
  }
}

export function monthLabel(month: string): string {
  const parsed = DateTime.fromISO(`${month}-01`)
  return parsed.isValid ? parsed.toFormat('LLLL yyyy') : month
}

export function shiftMonth(month: string, amount: number): string {
  const parsed = DateTime.fromISO(`${month}-01`).plus({ months: amount })
  return parsed.isValid ? parsed.toFormat('yyyy-MM') : month
}

export function daysInMonth(month: string): string[] {
  const start = DateTime.fromISO(`${month}-01`)
  if (!start.isValid) return []
  const count = start.daysInMonth ?? 0
  return Array.from({ length: count }, (_, index) => start.plus({ days: index }).toISODate() ?? '')
}

/** Monday is 0, Sunday is 6. */
export function weekdayIndexMonday(date: string): number {
  const parsed = DateTime.fromISO(date)
  if (!parsed.isValid) return 0
  return parsed.weekday - 1
}

export function bookingWindow(
  date: string,
  time: string,
  durationMinutes: number,
  zone: string,
): { start: number; end: number } | null {
  const start = DateTime.fromISO(`${date}T${time}`, { zone })
  if (!start.isValid || !Number.isFinite(durationMinutes)) return null
  return { start: start.toMillis(), end: start.plus({ minutes: durationMinutes }).toMillis() }
}

export function endTimeLabel(date: string, time: string, durationMinutes: number, zone: string): string {
  const start = DateTime.fromISO(`${date}T${time}`, { zone })
  if (!start.isValid) return time
  return start.plus({ minutes: durationMinutes }).toFormat('HH:mm')
}

export function suggestTime(date: string, today: string, zone: string, now: DateTime<true> | DateTime<false> = DateTime.now()): string {
  if (date !== today) return '19:00'
  const zoned = now.setZone(zone)
  if (!zoned.isValid) return '19:00'
  const minutes = zoned.hour * 60 + zoned.minute
  const rounded = Math.ceil(minutes / 15) * 15
  const capped = Math.min(rounded, 23 * 60 + 45)
  const hour = Math.floor(capped / 60)
  const minute = capped % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function shortDate(date: string): string {
  const parsed = DateTime.fromISO(date)
  return parsed.isValid ? parsed.toFormat('d LLL yyyy') : date
}
