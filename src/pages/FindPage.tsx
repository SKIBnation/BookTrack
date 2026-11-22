import { useState } from 'react'
import { BookingForm } from '../components/BookingForm.tsx'
import { BookingRow } from '../components/BookingCard.tsx'
import { PageHeader, fieldClass } from '../components/ui.tsx'
import { useBookData } from '../hooks/useBookData.tsx'
import { useBookingEditor } from '../hooks/useBookingEditor.ts'
import { matchesQuery, sortByRecent } from '../lib/bookings.ts'
import { shortDate } from '../lib/time.ts'

export function FindPage() {
  const { bookings, tables } = useBookData()
  const editor = useBookingEditor()
  const [query, setQuery] = useState('')
  const trimmed = query.trim()
  const matches = trimmed.length >= 2 ? sortByRecent(bookings.filter((booking) => matchesQuery(booking, trimmed))) : []

  return (
    <>
      <PageHeader title="Find" detail="Search a name, phone number, or note." />
      <input
        className={fieldClass}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Alex, 07700, birthday"
        autoComplete="off"
        aria-label="Search bookings"
      />
      {trimmed.length < 2 ? (
        <p className="mt-4 text-sm text-muted">Type at least two characters.</p>
      ) : matches.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No bookings match that search.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm text-muted">{matches.length} {matches.length === 1 ? 'booking' : 'bookings'}</p>
          {matches.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              tables={tables}
              meta={shortDate(booking.date)}
              onOpen={() => editor.edit(booking)}
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
