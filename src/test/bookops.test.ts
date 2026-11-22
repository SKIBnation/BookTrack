import { describe, expect, it } from 'vitest'
import { applyBookOp, emptyBook, type BookFile } from '../lib/bookops.ts'
import type { Booking } from '../types.ts'

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    guestName: 'Sam',
    phone: '07700900123',
    partySize: 2,
    date: '2026-11-22',
    time: '19:00',
    durationMinutes: 90,
    tableId: 'table-table1',
    status: 'booked',
    notes: '',
    createdAt: '2026-11-22T18:00:00.000Z',
    updatedAt: '2026-11-22T18:00:00.000Z',
    ...overrides,
  }
}

describe('shared book', () => {
  it('rejects a party larger than the table and accepts one that fits', () => {
    const book = emptyBook()
    const tooBig = applyBookOp(book, { type: 'saveBooking', booking: booking({ partySize: 6, tableId: 'table-table1' }) })
    expect(tooBig.error).toBe('Table 1 only seats 2. This party is 6 guests.')
    expect(tooBig.book.revision).toBe(book.revision)

    const fits = applyBookOp(book, { type: 'saveBooking', booking: booking({ partySize: 6, tableId: 'table-table12' }) })
    expect(fits.error).toBeNull()
    expect(fits.notify?.title).toBe('New booking')
    expect(fits.notify?.body).toContain('Table 12')
    expect(fits.book.bookings).toHaveLength(1)
  })

  it('refuses to seat a party that does not fit', () => {
    const saved = applyBookOp(emptyBook(), { type: 'saveBooking', booking: booking({ partySize: 4, tableId: 'table-table2' }) })
    const moved = applyBookOp(saved.book, { type: 'setStatus', id: 'b1', status: 'seated' })
    expect(moved.error).toBeNull()
    const overcrowded = applyBookOp(
      { ...moved.book, bookings: moved.book.bookings.map((item) => ({ ...item, tableId: 'table-table1', partySize: 4 })) },
      { type: 'setStatus', id: 'b1', status: 'seated' },
    )
    expect(overcrowded.error).toMatch(/Table 1 only seats 2/)
  })

  it('keeps table ids when the first phone uploads its book', () => {
    const local: BookFile = {
      ...emptyBook(),
      tables: [{ id: 'custom-1', name: 'Table 1', seats: 4, sort: 1 }],
      bookings: [booking({ tableId: 'custom-1', partySize: 2 })],
    }
    const seeded = applyBookOp(emptyBook(), { type: 'seed', settings: local.settings, tables: local.tables, bookings: local.bookings })
    expect(seeded.error).toBeNull()
    expect(seeded.book.tables.find((table) => table.name === 'Table 1')?.id).toBe('custom-1')
    expect(seeded.book.tables.find((table) => table.name === 'Table 1')?.seats).toBe(2)
    expect(seeded.book.tables.some((table) => table.name === 'Table 12' && table.seats === 8)).toBe(true)
    expect(seeded.book.bookings[0]?.tableId).toBe('custom-1')
  })
})
