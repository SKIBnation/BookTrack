import { DateTime } from 'luxon'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BookingForm } from '../components/BookingForm.tsx'
import { BookingCard } from '../components/BookingCard.tsx'
import { NotifyBanner } from '../components/NotifyBanner.tsx'
import { IconButton, PageHeader } from '../components/ui.tsx'
import { useSyncStatus } from '../hooks/useSyncStatus.ts'
import { useBookData } from '../hooks/useBookData.tsx'
import { useBookingEditor } from '../hooks/useBookingEditor.ts'
import { sortBookings, summarizeDay, tablesRightNow } from '../lib/bookings.ts'
import { setBookingStatus } from '../lib/db.ts'
import { staffName } from '../lib/staff.ts'
import { dayHeading, shiftDate } from '../lib/time.ts'

export function TodayPage() {
  const { settings, bookings, tables, today, date, chooseDate } = useBookData()
  const editor = useBookingEditor()
  const syncStatus = useSyncStatus()
  const [showClosed, setShowClosed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [now, setNow] = useState(() => DateTime.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(DateTime.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const floor = date === today ? tablesRightNow(tables, bookings, date, settings.timezone, now) : []
  const heading = dayHeading(date, today)
  const summary = summarizeDay(bookings, date)
  const day = sortBookings(bookings.filter((booking) => booking.date === date))
  const open = day.filter((booking) => booking.status !== 'cancelled' && booking.status !== 'no-show')
  const closed = day.filter((booking) => booking.status === 'cancelled' || booking.status === 'no-show')
  const closedCount = summary.cancelled + summary.noShow

  return (
    <>
      <PageHeader
        eyebrow={settings.restaurantName}
        title={heading.title}
        detail={heading.detail}
        action={<IconButton label="Add booking" onClick={() => editor.add(date)}><Plus size={22} /></IconButton>}
      />
      {syncStatus === 'offline' && (
        <p className="mb-4 text-sm text-danger">Can’t reach the shared book right now.</p>
      )}
      <NotifyBanner />
      {!staffName() && (
        <p className="mb-4 text-sm text-muted">Add your name in Settings so the other phone can see who took a booking.</p>
      )}
      {floor.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold">Tables right now</h2>
          <div className="grid grid-cols-2 gap-2">
            {floor.map(({ table, booking }) => (
              <div
                key={table.id}
                className={`rounded-2xl border px-3 py-3 ${booking ? 'border-stroke bg-card' : 'border-gain bg-[var(--gain-soft)]'}`}
              >
                <p className="font-semibold">{table.name}</p>
                <p className={`mt-1 text-sm ${booking ? 'text-fg' : 'text-gain'}`}>{booking ? booking.guestName : 'Free'}</p>
                {booking && (
                  <p className="mt-0.5 text-xs text-muted">{booking.status === 'seated' ? 'Seated' : `Booked ${booking.time}`}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="mb-4 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
        <button type="button" aria-label="Previous day" className="flex h-11 items-center justify-center rounded-2xl bg-card" onClick={() => chooseDate(shiftDate(date, -1))}>
          <ChevronLeft size={20} />
        </button>
        <button type="button" className="h-11 rounded-2xl bg-card text-sm font-semibold" onClick={() => chooseDate(null)}>
          {date === today ? 'Today' : 'Back to today'}
        </button>
        <button type="button" aria-label="Next day" className="flex h-11 items-center justify-center rounded-2xl bg-card" onClick={() => chooseDate(shiftDate(date, 1))}>
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="mb-5 grid grid-cols-3 gap-2">
        <CoverStat label="To arrive" value={summary.toArriveCovers} />
        <CoverStat label="Seated" value={summary.seatedCovers} />
        <CoverStat label="Finished" value={summary.doneCovers} />
      </div>
      {notice && <p className="mb-4 text-sm text-danger">{notice}</p>}
      <p className="mb-4 text-sm text-muted">
        {summary.bookings} {summary.bookings === 1 ? 'booking' : 'bookings'} · {summary.covers} {summary.covers === 1 ? 'cover' : 'covers'}
      </p>
      {open.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-stroke px-4 py-10 text-center">
          <p className="font-medium">Nothing booked</p>
          <p className="mt-1 text-sm text-muted">Add a reservation for this service.</p>
          <button type="button" className="mt-4 text-sm font-semibold text-gain" onClick={() => editor.add(date)}>
            Add a booking
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {open.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              bookings={bookings}
              tables={tables}
              zone={settings.timezone}
              onEdit={() => editor.edit(booking)}
              onStatus={(status) => {
                void setBookingStatus(booking.id, status).then(setNotice)
              }}
            />
          ))}
        </div>
      )}
      {closedCount > 0 && (
        <button type="button" className="mt-4 text-sm font-medium text-muted" onClick={() => setShowClosed((value) => !value)}>
          {showClosed ? 'Hide' : 'Show'} cancelled and no-shows ({closedCount})
        </button>
      )}
      {showClosed && (
        <div className="mt-3 flex flex-col gap-3">
          {closed.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              bookings={bookings}
              tables={tables}
              zone={settings.timezone}
              onEdit={() => editor.edit(booking)}
              onStatus={(status) => {
                void setBookingStatus(booking.id, status).then(setNotice)
              }}
            />
          ))}
        </div>
      )}
      {editor.form && (
        <BookingForm
          title={editor.form.id ? 'Edit booking' : 'New booking'}
          initial={editor.form.draft}
          bookingId={editor.form.id}
          onClose={editor.close}
          onSave={editor.save}
          onDelete={editor.form.id ? editor.remove : undefined}
        />
      )}
    </>
  )
}

function CoverStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-stroke bg-card px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-2 text-[22px] leading-none font-semibold tabular-nums">{value}</p>
    </div>
  )
}
