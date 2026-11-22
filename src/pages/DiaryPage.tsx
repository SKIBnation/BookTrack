import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookingForm } from '../components/BookingForm.tsx'
import { BookingRow } from '../components/BookingCard.tsx'
import { IconButton, PageHeader } from '../components/ui.tsx'
import { useBookData } from '../hooks/useBookData.tsx'
import { useBookingEditor } from '../hooks/useBookingEditor.ts'
import { coversByDate, sortBookings } from '../lib/bookings.ts'
import { dayHeading, daysInMonth, monthLabel, shiftMonth, weekdayIndexMonday } from '../lib/time.ts'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function DiaryPage() {
  const { bookings, tables, today, date, chooseDate } = useBookData()
  const editor = useBookingEditor()
  const [browseMonth, setBrowseMonth] = useState<string | null>(null)
  const [seenDate, setSeenDate] = useState(date)
  if (date !== seenDate) {
    setSeenDate(date)
    setBrowseMonth(null)
  }
  const month = browseMonth ?? date.slice(0, 7)
  const covers = coversByDate(bookings)
  const days = daysInMonth(month)
  const pad = days[0] ? weekdayIndexMonday(days[0]) : 0
  const selected = sortBookings(bookings.filter((booking) => booking.date === date))
  const heading = dayHeading(date, today)

  return (
    <>
      <PageHeader
        title="Diary"
        detail={monthLabel(month)}
        action={<IconButton label="Add booking" onClick={() => editor.add(date)}><Plus size={22} /></IconButton>}
      />
      <div className="mb-3 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
        <button type="button" aria-label="Previous month" className="flex h-11 items-center justify-center rounded-2xl bg-card" onClick={() => setBrowseMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={20} />
        </button>
        <button type="button" className="h-11 rounded-2xl bg-card text-sm font-semibold" onClick={() => { chooseDate(null); setBrowseMonth(null) }}>
          This month
        </button>
        <button type="button" aria-label="Next month" className="flex h-11 items-center justify-center rounded-2xl bg-card" onClick={() => setBrowseMonth(shiftMonth(month, 1))}>
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="rounded-[24px] border border-stroke bg-card p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
          {WEEKDAYS.map((day, index) => (
            <div key={`${day}-${index}`} className="py-1">{day}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: pad }, (_, index) => (
            <div key={`pad-${index}`} />
          ))}
          {days.map((day) => {
            const count = covers.get(day) ?? 0
            const selectedDay = day === date
            const isToday = day === today
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selectedDay}
                aria-label={`${day}${count ? `, ${count} covers` : ''}`}
                onClick={() => chooseDate(day)}
                className={`flex h-12 flex-col items-center justify-center rounded-xl text-sm tabular-nums ${selectedDay ? 'bg-gain font-semibold text-[var(--gain-ink)]' : isToday ? 'border border-gain text-gain' : 'text-fg'}`}
              >
                <span>{Number(day.slice(-2))}</span>
                {count > 0 && <span className={`text-[9px] leading-none ${selectedDay ? 'text-[var(--gain-ink)]' : 'text-gain'}`}>{count}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-5 mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{heading.title}</h2>
        <Link to="/" className="text-sm font-semibold text-gain">Open service</Link>
      </div>
      {selected.length === 0 ? (
        <p className="text-sm text-muted">No bookings on this day.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {selected.map((booking) => (
            <BookingRow key={booking.id} booking={booking} tables={tables} onOpen={() => editor.edit(booking)} />
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
