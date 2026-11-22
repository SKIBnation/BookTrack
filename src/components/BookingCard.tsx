import type { Booking, BookingStatus, DiningTable } from '../types.ts'
import { tableClash, tableName } from '../lib/bookings.ts'
import { guestLabel, statusLabel, telHref } from '../lib/format.ts'
import { Button, Card } from './ui.tsx'

const pillClass: Record<BookingStatus, string> = {
  booked: 'bg-[var(--gain-soft)] text-gain',
  seated: 'bg-gain text-[var(--gain-ink)]',
  done: 'bg-[var(--field)] text-muted',
  cancelled: 'bg-[var(--field)] text-faint',
  'no-show': 'bg-[var(--danger-soft)] text-danger',
}

export function StatusPill({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ${pillClass[status]}`}>
      {statusLabel(status)}
    </span>
  )
}

export function BookingCard({
  booking,
  bookings,
  tables,
  zone,
  onEdit,
  onStatus,
}: {
  booking: Booking
  bookings: Booking[]
  tables: DiningTable[]
  zone: string
  onEdit: () => void
  onStatus: (status: BookingStatus) => void
}) {
  const name = tableName(tables, booking.tableId)
  const clash = tableClash(booking, bookings, tables, zone)
  const phone = telHref(booking.phone)
  const closed = booking.status === 'cancelled' || booking.status === 'no-show'

  return (
    <Card className={closed ? 'opacity-70' : ''}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold tabular-nums">{booking.time}</p>
        </div>
        <StatusPill status={booking.status} />
      </div>
      <p className={`mt-3 text-lg font-semibold ${closed ? 'line-through' : ''}`}>{booking.guestName}</p>
      <p className="text-sm text-muted">
        {guestLabel(booking.partySize)}
        {name ? ` · ${name}` : ''}
      </p>
      {booking.takenBy && <p className="mt-1 text-sm text-muted">Added by {booking.takenBy}</p>}
      {booking.notes && <p className="mt-2 text-sm leading-5 text-muted">{booking.notes}</p>}
      {clash && <p className="mt-2 text-sm text-amber">{clash}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {booking.status === 'booked' && (
          <Button size="regular" onClick={() => onStatus('seated')}>
            Seat
          </Button>
        )}
        {booking.status === 'seated' && (
          <Button size="regular" onClick={() => onStatus('done')}>
            Finished
          </Button>
        )}
        {(booking.status === 'cancelled' || booking.status === 'no-show') && (
          <Button size="regular" onClick={() => onStatus('booked')}>
            Restore
          </Button>
        )}
        {phone && (
          <a href={phone} className="inline-flex h-10 items-center rounded-2xl border border-stroke px-3 text-sm font-semibold">
            Call
          </a>
        )}
        <Button size="regular" variant="secondary" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </Card>
  )
}

export function BookingRow({
  booking,
  tables,
  meta,
  onOpen,
}: {
  booking: Booking
  tables: DiningTable[]
  meta?: string
  onOpen: () => void
}) {
  const name = tableName(tables, booking.tableId)
  const closed = booking.status === 'cancelled' || booking.status === 'no-show'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-[20px] border border-stroke bg-card px-4 py-3 text-left"
    >
      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{booking.time}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-medium ${closed ? 'line-through' : ''}`}>{booking.guestName}</span>
        <span className="block truncate text-xs text-muted">
          {meta ? `${meta} · ` : ''}
          {guestLabel(booking.partySize)}
          {name ? ` · ${name}` : ''}
          {booking.takenBy ? ` · ${booking.takenBy}` : ''}
        </span>
      </span>
      <StatusPill status={booking.status} />
    </button>
  )
}
