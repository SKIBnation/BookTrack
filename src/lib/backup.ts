import type { Booking, DiningTable, Settings } from '../types.ts'
import { normalizeStatus, tableName } from './bookings.ts'
import { statusLabel } from './format.ts'
import { normalizeSettings } from './settings.ts'
import { endTimeLabel } from './time.ts'

export interface BackupFile {
  app: 'BookTrack'
  version: 1
  exportedAt: string
  settings: Settings
  bookings: Booking[]
  tables: DiningTable[]
}

export interface RestoredBackup {
  settings: Settings
  bookings: Booking[]
  tables: DiningTable[]
}

export function createBackup(settings: Settings, bookings: Booking[], tables: DiningTable[]): string {
  const payload: BackupFile = {
    app: 'BookTrack',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    bookings,
    tables,
  }
  return JSON.stringify(payload, null, 2)
}

export function parseBackup(text: string): RestoredBackup | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'That file isn’t valid JSON.' }
  }
  if (!parsed || typeof parsed !== 'object') return { error: 'That file isn’t a BookTrack backup.' }
  const value = parsed as Partial<BackupFile>
  if (value.app !== 'BookTrack' || value.version !== 1) return { error: 'That file isn’t a BookTrack backup.' }
  if (!value.settings || typeof value.settings !== 'object') return { error: 'The backup is missing settings.' }
  const bookings: Booking[] = []
  for (const item of Array.isArray(value.bookings) ? value.bookings : []) {
    const booking = normalizeBooking(item)
    if (booking) bookings.push(booking)
  }
  const tables: DiningTable[] = []
  for (const item of Array.isArray(value.tables) ? value.tables : []) {
    const table = normalizeTable(item)
    if (table) tables.push(table)
  }
  return {
    settings: normalizeSettings(value.settings),
    bookings: uniqueById(bookings),
    tables: uniqueById(tables),
  }
}

export function bookingsToCsv(bookings: Booking[], tables: DiningTable[], zone: string): string {
  const header = ['Date', 'Time', 'Until', 'Guest', 'Party', 'Phone', 'Table', 'Status', 'Taken by', 'Notes']
  const ordered = bookings
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.guestName.localeCompare(b.guestName))
  const rows = ordered.map((booking) => [
    booking.date,
    booking.time,
    endTimeLabel(booking.date, booking.time, booking.durationMinutes, zone),
    booking.guestName,
    String(booking.partySize),
    booking.phone,
    tableName(tables, booking.tableId) ?? '',
    statusLabel(booking.status),
    booking.takenBy ?? '',
    booking.notes,
  ])
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`
}

export async function shareOrDownload(filename: string, content: string, type: string): Promise<void> {
  const blob = new Blob([content], { type })
  const file = new File([blob], filename, { type })
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

function normalizeBooking(raw: unknown): Booking | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<Booking>
  if (typeof value.id !== 'string' || !value.id) return null
  if (typeof value.guestName !== 'string' || !value.guestName.trim()) return null
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null
  if (typeof value.time !== 'string' || !isTime(value.time)) return null
  const party = Number(value.partySize)
  if (!Number.isInteger(party) || party < 1 || party > 40) return null
  const duration = Number(value.durationMinutes)
  if (!Number.isInteger(duration) || duration < 15 || duration > 360) return null
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString()
  return {
    id: value.id,
    guestName: value.guestName.trim().slice(0, 80),
    phone: typeof value.phone === 'string' ? value.phone.trim().slice(0, 40) : '',
    partySize: party,
    date: value.date,
    time: value.time,
    durationMinutes: duration,
    tableId: typeof value.tableId === 'string' && value.tableId ? value.tableId : null,
    status: normalizeStatus(value.status),
    notes: typeof value.notes === 'string' ? value.notes.trim().slice(0, 500) : '',
    takenBy: typeof value.takenBy === 'string' ? value.takenBy.trim().slice(0, 40) : '',
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
  }
}

function normalizeTable(raw: unknown): DiningTable | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<DiningTable>
  if (typeof value.id !== 'string' || !value.id) return null
  if (typeof value.name !== 'string' || !value.name.trim()) return null
  const seats = Number(value.seats)
  if (!Number.isInteger(seats) || seats < 1 || seats > 30) return null
  const sort = Number.isInteger(Number(value.sort)) ? Number(value.sort) : 0
  return { id: value.id, name: value.name.trim().slice(0, 40), seats, sort }
}

function isTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [hour, minute] = value.split(':').map(Number)
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return result
}
