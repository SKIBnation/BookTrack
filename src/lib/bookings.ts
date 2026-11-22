import { DateTime } from 'luxon'
import type { Booking, BookingDraft, BookingStatus, DiningTable, Settings } from '../types.ts'
import { bookingWindow, suggestTime } from './time.ts'

const HOLDING: BookingStatus[] = ['booked', 'seated']

export function blankDraft(date: string, settings: Settings, today: string, now = DateTime.now()): BookingDraft {
  return {
    guestName: '',
    phone: '',
    partySize: settings.defaultPartySize,
    date,
    time: suggestTime(date, today, settings.timezone, now),
    durationMinutes: settings.defaultDurationMinutes,
    tableId: null,
    status: 'booked',
    notes: '',
  }
}

export function draftFromBooking(booking: Booking): BookingDraft {
  return {
    guestName: booking.guestName,
    phone: booking.phone,
    partySize: booking.partySize,
    date: booking.date,
    time: booking.time,
    durationMinutes: booking.durationMinutes,
    tableId: booking.tableId,
    status: booking.status,
    notes: booking.notes,
  }
}

export function validateDraft(draft: BookingDraft): string | null {
  const name = draft.guestName.trim()
  if (!name) return 'Add the guest’s name.'
  if (name.length > 80) return 'That name is too long.'
  if (!Number.isInteger(draft.partySize) || draft.partySize < 1 || draft.partySize > 40) {
    return 'Party size needs to be between 1 and 40.'
  }
  if (!isDate(draft.date)) return 'Choose a date.'
  if (!isTime(draft.time)) return 'Choose a time.'
  if (!Number.isInteger(draft.durationMinutes) || draft.durationMinutes < 15 || draft.durationMinutes > 360) {
    return 'Sitting length needs to be between 15 minutes and 6 hours.'
  }
  if (draft.phone.trim().length > 40) return 'That phone number is too long.'
  if (draft.notes.trim().length > 500) return 'Keep the note under 500 characters.'
  return null
}

export function sortBookings(bookings: Booking[]): Booking[] {
  return bookings.slice().sort((a, b) => a.time.localeCompare(b.time) || a.guestName.localeCompare(b.guestName) || a.id.localeCompare(b.id))
}

export function sortByRecent(bookings: Booking[]): Booking[] {
  return bookings
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || a.guestName.localeCompare(b.guestName))
}

export interface DaySummary {
  bookings: number
  covers: number
  toArrive: number
  toArriveCovers: number
  seated: number
  seatedCovers: number
  done: number
  doneCovers: number
  cancelled: number
  noShow: number
}

export function summarizeDay(bookings: Booking[], date: string): DaySummary {
  const day = bookings.filter((booking) => booking.date === date)
  const ofStatus = (status: BookingStatus) => day.filter((booking) => booking.status === status)
  const covers = (list: Booking[]) => list.reduce((sum, booking) => sum + booking.partySize, 0)
  const toArrive = ofStatus('booked')
  const seated = ofStatus('seated')
  const done = ofStatus('done')
  const active = [...toArrive, ...seated, ...done]
  return {
    bookings: active.length,
    covers: covers(active),
    toArrive: toArrive.length,
    toArriveCovers: covers(toArrive),
    seated: seated.length,
    seatedCovers: covers(seated),
    done: done.length,
    doneCovers: covers(done),
    cancelled: ofStatus('cancelled').length,
    noShow: ofStatus('no-show').length,
  }
}

export function tableName(tables: DiningTable[], tableId: string | null): string | null {
  if (!tableId) return null
  return tables.find((table) => table.id === tableId)?.name ?? null
}

export function tableClash(
  candidate: {
    id?: string
    date: string
    time: string
    durationMinutes: number
    tableId: string | null
    status: BookingStatus
  },
  bookings: Booking[],
  tables: DiningTable[],
  zone: string,
): string | null {
  if (!candidate.tableId || !HOLDING.includes(candidate.status)) return null
  const window = bookingWindow(candidate.date, candidate.time, candidate.durationMinutes, zone)
  if (!window) return null
  const name = tableName(tables, candidate.tableId) ?? 'That table'
  for (const other of bookings) {
    if (other.id === candidate.id || other.tableId !== candidate.tableId || !HOLDING.includes(other.status)) continue
    const otherWindow = bookingWindow(other.date, other.time, other.durationMinutes, zone)
    if (!otherWindow) continue
    if (window.start < otherWindow.end && otherWindow.start < window.end) {
      return `${name} is already held for ${other.guestName} at ${other.time}.`
    }
  }
  return null
}

export function partyFitsTable(partySize: number, tableId: string | null, tables: DiningTable[]): string | null {
  if (!tableId) return null
  const table = tables.find((item) => item.id === tableId)
  if (!table || partySize <= table.seats) return null
  return `${table.name} seats ${table.seats}. This party is ${partySize}.`
}

export function draftWarnings(
  draft: BookingDraft,
  bookings: Booking[],
  tables: DiningTable[],
  zone: string,
  id?: string,
): string[] {
  const warnings: string[] = []
  const clash = tableClash({ ...draft, id }, bookings, tables, zone)
  const fit = partyFitsTable(draft.partySize, draft.tableId, tables)
  if (clash) warnings.push(clash)
  if (fit) warnings.push(fit)
  return warnings
}

export function matchesQuery(booking: Booking, query: string): boolean {
  const text = query.trim().toLowerCase()
  if (!text) return false
  if (booking.guestName.toLowerCase().includes(text) || booking.notes.toLowerCase().includes(text)) return true
  const digits = text.replace(/\D/g, '')
  if (digits.length >= 3 && booking.phone.replace(/\D/g, '').includes(digits)) return true
  return false
}

export function previousVisit(bookings: Booking[], name: string, excludeId?: string): Booking | null {
  const key = name.trim().toLowerCase()
  if (key.length < 2) return null
  const matches = sortByRecent(
    bookings.filter((booking) => booking.id !== excludeId && booking.guestName.trim().toLowerCase() === key),
  )
  return matches[0] ?? null
}

export function coversByDate(bookings: Booking[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const booking of bookings) {
    if (booking.status === 'cancelled' || booking.status === 'no-show') continue
    map.set(booking.date, (map.get(booking.date) ?? 0) + booking.partySize)
  }
  return map
}

export function normalizeStatus(value: unknown): BookingStatus {
  if (value === 'seated' || value === 'done' || value === 'cancelled' || value === 'no-show' || value === 'booked') return value
  return 'booked'
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && DateTime.fromISO(value).isValid
}

function isTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [hour, minute] = value.split(':').map(Number)
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}
