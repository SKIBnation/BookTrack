import Dexie, { type EntityTable } from 'dexie'
import type { Booking, BookingDraft, BookingStatus, DiningTable, Settings } from '../types.ts'
import type { RestoredBackup } from './backup.ts'
import { validateDraft } from './bookings.ts'
import { normalizeSettings, rememberTheme, SETTINGS_ID } from './settings.ts'

const globalStore = globalThis as unknown as { __booktrackDb?: BookDatabase }

type BookDatabase = Dexie & {
  bookings: EntityTable<Booking, 'id'>
  diningTables: EntityTable<DiningTable, 'id'>
  settings: EntityTable<Settings, 'id'>
}

function createDatabase(): BookDatabase {
  const database = new Dexie('BookTrack') as BookDatabase
  database.version(1).stores({
    bookings: 'id, date, status',
    diningTables: 'id, sort',
    settings: 'id',
  })
  database.on('ready', async () => {
    const existing = await database.settings.get(SETTINGS_ID)
    if (!existing) await database.settings.put(defaultRow())
  })
  return database
}

function defaultRow(): Settings {
  return normalizeSettings(null)
}

export const db = globalStore.__booktrackDb ?? createDatabase()
globalStore.__booktrackDb = db

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

let settingsWrite: Promise<void> = Promise.resolve()

export function updateSettings(patch: Partial<Settings>): Promise<void> {
  const run = settingsWrite.then(async () => {
    const current = normalizeSettings(await db.settings.get(SETTINGS_ID))
    const next = normalizeSettings({ ...current, ...patch, id: SETTINGS_ID })
    await db.settings.put(next)
    rememberTheme(next.theme)
  })
  settingsWrite = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function saveBooking(draft: BookingDraft, id?: string): Promise<string | null> {
  const error = validateDraft(draft)
  if (error) return error
  const now = new Date().toISOString()
  if (id) {
    const existing = await db.bookings.get(id)
    if (!existing) return 'That booking is no longer on this device.'
    await db.bookings.put(toBooking(draft, id, existing.createdAt, now))
    return null
  }
  await db.bookings.add(toBooking(draft, uid(), now, now))
  return null
}

export async function setBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const existing = await db.bookings.get(id)
  if (!existing) return
  await db.bookings.update(id, { status, updatedAt: new Date().toISOString() })
}

export async function deleteBooking(id: string): Promise<void> {
  await db.bookings.delete(id)
}

export async function addTable(name: string, seats: number): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return 'Name the table.'
  if (trimmed.length > 40) return 'That table name is too long.'
  if (!Number.isInteger(seats) || seats < 1 || seats > 30) return 'Seats need to be between 1 and 30.'
  const existing = await db.diningTables.toArray()
  if (existing.some((table) => table.name.toLowerCase() === trimmed.toLowerCase())) {
    return 'You already have a table with that name.'
  }
  const sort = existing.reduce((max, table) => Math.max(max, table.sort), 0) + 1
  await db.diningTables.add({ id: uid(), name: trimmed, seats, sort })
  return null
}

export async function updateTable(id: string, patch: { name?: string; seats?: number }): Promise<string | null> {
  const current = await db.diningTables.get(id)
  if (!current) return 'That table is no longer on this device.'
  const name = patch.name === undefined ? current.name : patch.name.trim()
  const seats = patch.seats === undefined ? current.seats : patch.seats
  if (!name) return 'Name the table.'
  if (name.length > 40) return 'That table name is too long.'
  if (!Number.isInteger(seats) || seats < 1 || seats > 30) return 'Seats need to be between 1 and 30.'
  const existing = await db.diningTables.toArray()
  if (existing.some((table) => table.id !== id && table.name.toLowerCase() === name.toLowerCase())) {
    return 'You already have a table with that name.'
  }
  await db.diningTables.update(id, { name, seats })
  return null
}

export async function deleteTable(id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.transaction('rw', db.diningTables, db.bookings, async () => {
    await db.diningTables.delete(id)
    const linked = await db.bookings.filter((booking) => booking.tableId === id).toArray()
    await Promise.all(linked.map((booking) => db.bookings.update(booking.id, { tableId: null, updatedAt: now })))
  })
}

export async function restoreBackup(data: RestoredBackup): Promise<void> {
  await db.transaction('rw', db.bookings, db.diningTables, db.settings, async () => {
    await db.bookings.clear()
    await db.diningTables.clear()
    await db.settings.clear()
    if (data.bookings.length) await db.bookings.bulkAdd(data.bookings)
    if (data.tables.length) await db.diningTables.bulkAdd(data.tables)
    await db.settings.put(data.settings)
  })
  rememberTheme(data.settings.theme)
}

function toBooking(draft: BookingDraft, id: string, createdAt: string, updatedAt: string): Booking {
  return {
    id,
    guestName: draft.guestName.trim(),
    phone: draft.phone.trim(),
    partySize: draft.partySize,
    date: draft.date,
    time: draft.time,
    durationMinutes: draft.durationMinutes,
    tableId: draft.tableId,
    status: draft.status,
    notes: draft.notes.trim(),
    createdAt,
    updatedAt,
  }
}
