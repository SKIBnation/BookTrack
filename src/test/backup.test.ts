import { describe, expect, it } from 'vitest'
import { bookingsToCsv, createBackup, parseBackup } from '../lib/backup.ts'
import type { Booking, DiningTable, Settings } from '../types.ts'
import { defaultSettings } from '../lib/settings.ts'

const settings: Settings = { ...defaultSettings('Europe/London'), restaurantName: 'Harbour' }
const table: DiningTable = { id: 't1', name: 'Table 4', seats: 4, sort: 1 }
const booking: Booking = {
  id: 'b1',
  guestName: 'Alex, Morgan',
  phone: '07700 900123',
  partySize: 2,
  date: '2026-11-22',
  time: '19:00',
  durationMinutes: 90,
  tableId: 't1',
  status: 'booked',
  notes: 'Says "window"',
  takenBy: 'Sam',
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
}

describe('backups', () => {
  it('round-trips the book and skips a broken booking', () => {
    const raw = JSON.parse(createBackup(settings, [booking], [table])) as { bookings: unknown[] }
    raw.bookings.push({ id: 'bad' })
    const parsed = parseBackup(JSON.stringify(raw))
    expect('error' in parsed).toBe(false)
    if ('error' in parsed) return
    expect(parsed.settings.restaurantName).toBe('Harbour')
    expect(parsed.bookings).toHaveLength(1)
    expect(parsed.bookings[0]?.guestName).toBe('Alex, Morgan')
    expect(parsed.tables[0]?.name).toBe('Table 4')
  })

  it('rejects a file from another app', () => {
    expect(parseBackup('{')).toEqual({ error: 'That file isn’t valid JSON.' })
    expect(parseBackup(JSON.stringify({ app: 'WorkTrack', version: 1 }))).toEqual({
      error: 'That file isn’t a BookTrack backup.',
    })
  })

  it('writes a spreadsheet that keeps commas and the pound-safe byte order mark', () => {
    const csv = bookingsToCsv([booking], [table], 'Europe/London')
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"Alex, Morgan"')
    expect(csv).toContain('"Says ""window"""')
    expect(csv).toContain('Table 4')
    expect(csv).toContain('20:30')
  })
})
