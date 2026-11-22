import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import type { Booking, DiningTable } from '../types.ts'
import {
  blankDraft,
  coversByDate,
  draftWarnings,
  matchesQuery,
  previousVisit,
  summarizeDay,
  tableClash,
  validateDraft,
} from '../lib/bookings.ts'
import { defaultSettings } from '../lib/settings.ts'
import { dayHeading, daysInMonth, shiftDate, suggestTime, weekdayIndexMonday } from '../lib/time.ts'

const zone = 'Europe/London'
const tables: DiningTable[] = [
  { id: 't1', name: 'Table 4', seats: 2, sort: 1 },
  { id: 't2', name: 'Window', seats: 4, sort: 2 },
]

function booking(patch: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    guestName: 'Alex Morgan',
    phone: '07700 900123',
    partySize: 2,
    date: '2026-11-22',
    time: '19:00',
    durationMinutes: 90,
    tableId: 't1',
    status: 'booked',
    notes: 'Birthday',
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    ...patch,
  }
}

describe('the day book', () => {
  it('counts covers still expected and leaves out cancellations', () => {
    const summary = summarizeDay(
      [
        booking({ id: 'a', status: 'booked', partySize: 2 }),
        booking({ id: 'b', status: 'seated', partySize: 4, time: '18:00' }),
        booking({ id: 'c', status: 'done', partySize: 3, time: '12:30' }),
        booking({ id: 'd', status: 'cancelled', partySize: 6, time: '20:00' }),
        booking({ id: 'e', status: 'no-show', partySize: 5, time: '20:30' }),
        booking({ id: 'f', date: '2026-11-23', partySize: 8 }),
      ],
      '2026-11-22',
    )
    expect(summary.bookings).toBe(3)
    expect(summary.covers).toBe(9)
    expect(summary.toArriveCovers).toBe(2)
    expect(summary.seatedCovers).toBe(4)
    expect(summary.doneCovers).toBe(3)
    expect(summary.cancelled).toBe(1)
    expect(summary.noShow).toBe(1)
    expect(coversByDate([booking({ status: 'cancelled', partySize: 6 })]).get('2026-11-22')).toBeUndefined()
  })

  it('warns when the same table is held across midnight', () => {
    const late = booking({ id: 'late', time: '23:00', durationMinutes: 120, guestName: 'Alex' })
    const early = booking({ id: 'early', date: '2026-11-23', time: '00:30', durationMinutes: 90, guestName: 'Sam' })
    expect(tableClash(early, [late], tables, zone)).toBe('Table 4 is already held for Alex at 23:00.')
  })

  it('lets the next sitting start when the previous one ends', () => {
    const first = booking({ time: '23:00', durationMinutes: 60 })
    const next = booking({ id: 'next', date: '2026-11-23', time: '00:00' })
    expect(tableClash(next, [first], tables, zone)).toBeNull()
  })

  it('ignores a finished sitting when the table is booked again', () => {
    const finished = booking({ status: 'done' })
    const next = booking({ id: 'next', time: '19:30' })
    expect(tableClash(next, [finished], tables, zone)).toBeNull()
  })

  it('warns when the party is larger than the table, then still allows a different table', () => {
    const draft = { ...blankDraft('2026-11-22', defaultSettings(zone), '2026-11-22'), partySize: 4, tableId: 't1', guestName: 'Sam' }
    expect(draftWarnings(draft, [], tables, zone)).toEqual(['Table 4 seats 2. This party is 4.'])
    expect(draftWarnings({ ...draft, tableId: 't2' }, [], tables, zone)).toEqual([])
  })
})

describe('finding guests', () => {
  it('matches a phone number with the spaces removed', () => {
    expect(matchesQuery(booking(), '900123')).toBe(true)
    expect(matchesQuery(booking(), '12')).toBe(false)
    expect(matchesQuery(booking(), 'birthday')).toBe(true)
  })

  it('finds the latest visit for the same name', () => {
    const older = booking({ id: 'old', date: '2026-10-01', guestName: 'alex morgan' })
    const newer = booking({ id: 'new', date: '2026-11-02', guestName: 'Alex Morgan' })
    expect(previousVisit([older, newer], ' Alex Morgan ', 'other')?.id).toBe('new')
    expect(previousVisit([older, newer], 'Alex Morgan', 'new')?.id).toBe('old')
  })
})

describe('draft checks', () => {
  const settings = defaultSettings(zone)

  it('asks for a name and rejects a party of zero', () => {
    const draft = blankDraft('2026-11-22', settings, '2026-11-22')
    expect(validateDraft(draft)).toBe('Add the guest’s name.')
    expect(validateDraft({ ...draft, guestName: 'Sam', partySize: 0 })).toMatch(/Party size/)
    expect(validateDraft({ ...draft, guestName: 'Sam' })).toBe('Add a phone number.')
    expect(validateDraft({ ...draft, guestName: 'Sam', phone: '07700900123' })).toBeNull()
  })

  it('suggests the next quarter hour today and 19:00 on another day', () => {
    const now = DateTime.fromISO('2026-11-22T18:01:00', { zone })
    expect(suggestTime('2026-11-22', '2026-11-22', zone, now)).toBe('18:15')
    expect(suggestTime('2026-11-23', '2026-11-22', zone, now)).toBe('19:00')
  })
})

describe('dates', () => {
  it('walks across a month boundary and labels today', () => {
    expect(shiftDate('2026-11-30', 1)).toBe('2026-12-01')
    expect(dayHeading('2026-11-22', '2026-11-22').title).toBe('Today')
    expect(weekdayIndexMonday('2026-11-16')).toBe(0)
    expect(weekdayIndexMonday('2026-11-22')).toBe(6)
    expect(daysInMonth('2026-11')).toHaveLength(30)
    expect(daysInMonth('2026-02')).toHaveLength(28)
  })
})
