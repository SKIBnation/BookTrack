import type { Booking, BookingStatus, DiningTable, Settings } from '../types.ts'
import { normalizeStatus, partyFitsTable, STANDARD_TABLES, tableKey, tableName, validateDraft } from './bookings.ts'
import { guestLabel } from './format.ts'
import { defaultSettings, normalizeSettings } from './settings.ts'

export interface BookFile {
  revision: number
  settings: Settings
  tables: DiningTable[]
  bookings: Booking[]
}

export interface BookingNotice {
  title: string
  body: string
  tag: string
}

export type BookOp =
  | { type: 'saveBooking'; booking: Booking }
  | { type: 'setStatus'; id: string; status: BookingStatus }
  | { type: 'deleteBooking'; id: string }
  | { type: 'addTable'; table: DiningTable }
  | { type: 'updateTable'; id: string; name: string; seats: number }
  | { type: 'deleteTable'; id: string }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'seed'; settings: Settings; tables: DiningTable[]; bookings: Booking[] }
  | { type: 'replace'; settings: Settings; tables: DiningTable[]; bookings: Booking[] }

export interface BookOpResult {
  book: BookFile
  error: string | null
  notify: BookingNotice | null
}

export function emptyBook(): BookFile {
  return alignStandardTables({
    revision: 0,
    settings: defaultSettings('Europe/London'),
    tables: [],
    bookings: [],
  })
}

export function alignStandardTables(book: BookFile): BookFile {
  const tables = book.tables.map((table) => ({ ...table }))
  const byKey = new Map(tables.map((table) => [tableKey(table.name), table]))
  let sort = tables.reduce((max, table) => Math.max(max, table.sort), 0)
  for (const standard of STANDARD_TABLES) {
    const current = byKey.get(tableKey(standard.name))
    if (!current) {
      sort += 1
      const created: DiningTable = {
        id: `table-${tableKey(standard.name)}`,
        name: standard.name,
        seats: standard.seats,
        sort,
      }
      tables.push(created)
      byKey.set(tableKey(standard.name), created)
      continue
    }
    current.seats = standard.seats
  }
  return { ...book, tables }
}

export function applyBookOp(input: BookFile, op: BookOp): BookOpResult {
  const book = alignStandardTables(cloneBook(input))
  if (op.type === 'seed') return installBook(book, op, true)
  if (op.type === 'replace') return installBook(book, op, false)
  if (op.type === 'saveBooking') return saveBooking(book, op.booking)
  if (op.type === 'setStatus') return setStatus(book, op.id, op.status)
  if (op.type === 'deleteBooking') {
    if (!book.bookings.some((booking) => booking.id === op.id)) return fail(book, 'That booking is no longer in the book.')
    return ok({ ...book, bookings: book.bookings.filter((booking) => booking.id !== op.id) }, null)
  }
  if (op.type === 'addTable') return addTable(book, op.table)
  if (op.type === 'updateTable') return updateTable(book, op.id, op.name, op.seats)
  if (op.type === 'deleteTable') return deleteTable(book, op.id)
  if (op.type === 'updateSettings') {
    return ok({ ...book, settings: normalizeSettings({ ...book.settings, ...op.patch, id: 'app' }) }, null)
  }
  return fail(book, 'That change isn’t recognised.')
}

export function bookingNotice(booking: Booking, tables: DiningTable[], title = 'New booking'): BookingNotice {
  const table = tableName(tables, booking.tableId)
  const where = table ? ` · ${table}` : ''
  return {
    title,
    body: `${booking.guestName} · ${guestLabel(booking.partySize)}${where} · ${booking.time}`,
    tag: `booking-${booking.id}`,
  }
}

export function changeNotice(previous: Booking, next: Booking, tables: DiningTable[]): BookingNotice | null {
  if (next.status === 'cancelled' && previous.status !== 'cancelled') return bookingNotice(next, tables, 'Cancelled')
  if (next.status === 'seated' && previous.status !== 'seated') return bookingNotice(next, tables, 'Seated')
  const moved = previous.tableId !== next.tableId || previous.date !== next.date || previous.time !== next.time
  if (moved) return bookingNotice(next, tables, 'Moved')
  return null
}

function installBook(book: BookFile, op: Extract<BookOp, { type: 'seed' | 'replace' }>, onlyWhenEmpty: boolean): BookOpResult {
  if (onlyWhenEmpty && book.bookings.length > 0) return fail(book, 'The book already has bookings.')
  const settings = normalizeSettings(op.settings)
  const seededTables: DiningTable[] = []
  for (const item of op.tables) {
    const cleaned = cleanTable(item, seededTables)
    if ('table' in cleaned) seededTables.push(cleaned.table)
  }
  const aligned = alignStandardTables({ ...book, settings, tables: seededTables, bookings: [] })
  const bookings: Booking[] = []
  for (const item of op.bookings) {
    const cleaned = cleanBooking(item, aligned.tables, item.createdAt, item.takenBy)
    if ('booking' in cleaned) bookings.push(cleaned.booking)
  }
  return ok({ ...aligned, settings, bookings }, null)
}

function saveBooking(book: BookFile, input: Booking): BookOpResult {
  const existing = book.bookings.find((booking) => booking.id === input.id)
  const cleaned = cleanBooking(input, book.tables, existing?.createdAt ?? input.createdAt, existing ? (existing.takenBy ?? '') : input.takenBy)
  if ('error' in cleaned) return fail(book, cleaned.error)
  const bookings = existing
    ? book.bookings.map((booking) => (booking.id === cleaned.booking.id ? cleaned.booking : booking))
    : [...book.bookings, cleaned.booking]
  if (bookings.length > 5000) return fail(book, 'The book is full.')
  const notice = existing ? changeNotice(existing, cleaned.booking, book.tables) : bookingNotice(cleaned.booking, book.tables)
  return ok({ ...book, bookings }, notice)
}

function setStatus(book: BookFile, id: string, status: BookingStatus): BookOpResult {
  const existing = book.bookings.find((booking) => booking.id === id)
  if (!existing) return fail(book, 'That booking is no longer in the book.')
  const nextStatus = normalizeStatus(status)
  if (nextStatus === 'seated') {
    const fit = partyFitsTable(existing.partySize, existing.tableId, book.tables)
    if (fit) return fail(book, fit)
  }
  const next = { ...existing, status: nextStatus, updatedAt: new Date().toISOString() }
  const bookings = book.bookings.map((booking) => (booking.id === id ? next : booking))
  return ok({ ...book, bookings }, changeNotice(existing, next, book.tables))
}

function addTable(book: BookFile, input: DiningTable): BookOpResult {
  const cleaned = cleanTable(input, book.tables)
  if ('error' in cleaned) return fail(book, cleaned.error)
  return ok({ ...book, tables: [...book.tables, cleaned.table] }, null)
}

function updateTable(book: BookFile, id: string, name: string, seats: number): BookOpResult {
  const existing = book.tables.find((table) => table.id === id)
  if (!existing) return fail(book, 'That table is no longer in the book.')
  const cleaned = cleanTable({ ...existing, name, seats }, book.tables, id)
  if ('error' in cleaned) return fail(book, cleaned.error)
  const tables = book.tables.map((table) => (table.id === id ? cleaned.table : table))
  return ok(alignStandardTables({ ...book, tables }), null)
}

function deleteTable(book: BookFile, id: string): BookOpResult {
  if (!book.tables.some((table) => table.id === id)) return fail(book, 'That table is no longer in the book.')
  const now = new Date().toISOString()
  return ok(
    {
      ...book,
      tables: book.tables.filter((table) => table.id !== id),
      bookings: book.bookings.map((booking) => (booking.tableId === id ? { ...booking, tableId: null, updatedAt: now } : booking)),
    },
    null,
  )
}

function cleanBooking(
  input: Booking,
  tables: DiningTable[],
  createdAt: string | undefined,
  takenBy: string | undefined,
): { booking: Booking } | { error: string } {
  const id = cleanId(input.id)
  if (!id) return { error: 'That booking is missing an id.' }
  const draft = {
    guestName: text(input.guestName),
    phone: text(input.phone),
    partySize: Number(input.partySize),
    date: text(input.date),
    time: text(input.time),
    durationMinutes: clamp(input.durationMinutes, 15, 360, 90),
    tableId: typeof input.tableId === 'string' && input.tableId ? input.tableId : null,
    status: normalizeStatus(input.status),
    notes: text(input.notes),
  }
  const error = validateDraft(draft) ?? partyFitsTable(draft.partySize, draft.tableId, tables)
  if (error) return { error }
  const now = new Date().toISOString()
  return {
    booking: {
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
      takenBy: cleanTakenBy(takenBy),
      createdAt: typeof createdAt === 'string' && createdAt ? createdAt : now,
      updatedAt: now,
    },
  }
}

function cleanTable(input: DiningTable, tables: DiningTable[], ignoreId?: string): { table: DiningTable } | { error: string } {
  const name = text(input.name).trim()
  const seats = Number(input.seats)
  if (!name) return { error: 'Name the table.' }
  if (name.length > 40) return { error: 'That table name is too long.' }
  if (!Number.isInteger(seats) || seats < 1 || seats > 30) return { error: 'Seats need to be between 1 and 30.' }
  if (tables.some((table) => table.id !== ignoreId && table.name.toLowerCase() === name.toLowerCase())) {
    return { error: 'You already have a table with that name.' }
  }
  const id = cleanId(input.id)
  if (!id) return { error: 'That table is missing an id.' }
  const sort = Number.isInteger(input.sort) ? input.sort : tables.length + 1
  return { table: { id, name, seats, sort } }
}

function ok(book: BookFile, notify: BookingNotice | null): BookOpResult {
  return { book: { ...book, revision: book.revision + 1 }, error: null, notify }
}

function fail(book: BookFile, error: string): BookOpResult {
  return { book, error, notify: null }
}

function cloneBook(book: BookFile): BookFile {
  return {
    revision: book.revision,
    settings: { ...book.settings },
    tables: book.tables.map((table) => ({ ...table })),
    bookings: book.bookings.map((booking) => ({ ...booking })),
  }
}

function cleanId(value: unknown): string {
  if (typeof value !== 'string') return ''
  const id = value.trim()
  if (!id || id.length > 80) return ''
  return id
}

function cleanTakenBy(value: unknown): string {
  return text(value).trim().slice(0, 40)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(number)) return fallback
  return Math.min(max, Math.max(min, number))
}
