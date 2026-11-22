import Dexie, { type EntityTable } from 'dexie'
import type { Booking, BookingDraft, BookingStatus, DiningTable, Settings } from '../types.ts'
import { commitOp, hasSession } from './api.ts'
import type { RestoredBackup } from './backup.ts'
import type { BookFile, BookOp } from './bookops.ts'
import { validateDraft, partyFitsTable, STANDARD_TABLES, tableKey } from './bookings.ts'
import { normalizeSettings, rememberTheme, SETTINGS_ID } from './settings.ts'
import { staffName } from './staff.ts'
import { enqueue } from './turn.ts'

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
    await ensureDefaultTables(database)
  })
  return database
}

function defaultRow(): Settings {
  return normalizeSettings(null)
}

const DEFAULT_TABLES = STANDARD_TABLES

async function ensureDefaultTables(database: BookDatabase): Promise<void> {
  const existing = await database.diningTables.toArray()
  const byKey = new Map(existing.map((table) => [tableKey(table.name), table]))
  let sort = existing.reduce((max, table) => Math.max(max, table.sort), 0)
  for (const standard of DEFAULT_TABLES) {
    const current = byKey.get(tableKey(standard.name))
    if (!current) {
      sort += 1
      await database.diningTables.add({ id: uid(), name: standard.name, seats: standard.seats, sort })
      continue
    }
    if (current.seats !== standard.seats) await database.diningTables.update(current.id, { seats: standard.seats })
  }
}

export const db = globalStore.__booktrackDb ?? createDatabase()
globalStore.__booktrackDb = db

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

let settingsWrite: Promise<void> = Promise.resolve()

export function updateSettings(patch: Partial<Settings>): Promise<string | null> {
  const run = settingsWrite.then(async () => publish({ type: 'updateSettings', patch }))
  settingsWrite = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function readLocalBook(): Promise<BookFile> {
  const settings = normalizeSettings(await db.settings.get(SETTINGS_ID))
  return {
    revision: 0,
    settings,
    tables: await db.diningTables.toArray(),
    bookings: await db.bookings.toArray(),
  }
}

export async function replaceFromServer(book: BookFile): Promise<void> {
  const settings = normalizeSettings(book.settings)
  await db.transaction('rw', db.bookings, db.diningTables, db.settings, async () => {
    await db.bookings.clear()
    await db.diningTables.clear()
    await db.settings.clear()
    if (book.bookings.length) await db.bookings.bulkAdd(book.bookings)
    if (book.tables.length) await db.diningTables.bulkAdd(book.tables)
    await db.settings.put(settings)
  })
  rememberTheme(settings.theme)
}

export async function saveBooking(draft: BookingDraft, id?: string): Promise<string | null> {
  const error = validateDraft(draft) ?? partyFitsTable(draft.partySize, draft.tableId, await db.diningTables.toArray())
  if (error) return error
  const now = new Date().toISOString()
  const existing = id ? await db.bookings.get(id) : undefined
  if (id && !existing) return 'That booking is no longer in the book.'
  const booking = toBooking(draft, id ?? uid(), existing?.createdAt ?? now, now, existing ? (existing.takenBy ?? '') : staffName())
  return publish({ type: 'saveBooking', booking })
}

export async function setBookingStatus(id: string, status: BookingStatus): Promise<string | null> {
  const existing = await db.bookings.get(id)
  if (!existing) return null
  if (status === 'seated') {
    const fit = partyFitsTable(existing.partySize, existing.tableId, await db.diningTables.toArray())
    if (fit) return fit
  }
  return publish({ type: 'setStatus', id, status })
}

export async function deleteBooking(id: string): Promise<string | null> {
  return publish({ type: 'deleteBooking', id })
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
  return publish({ type: 'addTable', table: { id: uid(), name: trimmed, seats, sort } })
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
  return publish({ type: 'updateTable', id, name, seats })
}

export async function deleteTable(id: string): Promise<string | null> {
  return publish({ type: 'deleteTable', id })
}

export async function restoreBackup(data: RestoredBackup): Promise<string | null> {
  return publish({ type: 'replace', settings: data.settings, tables: data.tables, bookings: data.bookings })
}

async function publish(op: BookOp): Promise<string | null> {
  if (!hasSession()) return 'Open the book with the password first.'
  const result = await enqueue(() => commitOp(op))
  if (typeof result === 'string') return result
  await replaceFromServer(result)
  return null
}

function toBooking(draft: BookingDraft, id: string, createdAt: string, updatedAt: string, takenBy: string): Booking {
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
    takenBy: takenBy.trim().slice(0, 40),
    createdAt,
    updatedAt,
  }
}
