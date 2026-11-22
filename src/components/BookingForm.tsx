import { useState } from 'react'
import type { BookingDraft, BookingStatus } from '../types.ts'
import { DURATION_OPTIONS } from '../lib/settings.ts'
import { draftWarnings, previousVisit, validateDraft } from '../lib/bookings.ts'
import { durationLabel, guestLabel } from '../lib/format.ts'
import { shortDate } from '../lib/time.ts'
import { useBookData } from '../hooks/useBookData.tsx'
import { Button, Confirm, Field, Sheet, fieldClass } from './ui.tsx'

export function BookingForm({
  title,
  initial,
  bookingId,
  onClose,
  onSave,
  onDelete,
}: {
  title: string
  initial: BookingDraft
  bookingId?: string
  onClose: () => void
  onSave: (draft: BookingDraft) => Promise<string | null>
  onDelete?: () => Promise<void>
}) {
  const { bookings, tables, settings } = useBookData()
  const [draft, setDraft] = useState(initial)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<string[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const visit = previousVisit(bookings, draft.guestName, bookingId)
  const durations = DURATION_OPTIONS.includes(draft.durationMinutes)
    ? DURATION_OPTIONS
    : [draft.durationMinutes, ...DURATION_OPTIONS].sort((a, b) => a - b)

  async function commit(next: BookingDraft) {
    setSaving(true)
    try {
      const error = await onSave(next)
      if (error) setMessage(error)
      else onClose()
    } catch {
      setMessage('The booking could not be saved on this device.')
    } finally {
      setSaving(false)
    }
  }

  function requestSave() {
    const error = validateDraft(draft)
    if (error) {
      setMessage(error)
      return
    }
    const warnings = draftWarnings(draft, bookings, tables, settings.timezone, bookingId)
    if (warnings.length) {
      setPending(warnings)
      return
    }
    void commit(draft)
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          requestSave()
        }}
      >
        <Field label="Guest">
          <input
            className={fieldClass}
            value={draft.guestName}
            onChange={(event) => setDraft({ ...draft, guestName: event.target.value })}
            autoComplete="name"
            placeholder="Name"
          />
          {visit && (
            <span className="mt-1.5 block text-xs leading-5 text-muted">
              Last booked {shortDate(visit.date)} at {visit.time}, {guestLabel(visit.partySize)}.
            </span>
          )}
        </Field>
        <Field label="Phone">
          <input
            className={fieldClass}
            value={draft.phone}
            onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            inputMode="tel"
            autoComplete="tel"
            placeholder="Optional"
          />
        </Field>
        <Field label="Party">
          <span className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Fewer guests"
              className="h-12 w-12 rounded-xl bg-[var(--field)] text-lg"
              onClick={() => setDraft({ ...draft, partySize: Math.max(1, draft.partySize - 1) })}
            >
              −
            </button>
            <input
              className={`${fieldClass} text-center`}
              inputMode="numeric"
              value={draft.partySize}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isInteger(next)) setDraft({ ...draft, partySize: next })
              }}
            />
            <button
              type="button"
              aria-label="More guests"
              className="h-12 w-12 rounded-xl bg-[var(--field)] text-lg"
              onClick={() => setDraft({ ...draft, partySize: Math.min(40, draft.partySize + 1) })}
            >
              +
            </button>
          </span>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">
            <input
              className={fieldClass}
              type="date"
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            />
          </Field>
          <Field label="Time">
            <input
              className={fieldClass}
              type="time"
              value={draft.time}
              onChange={(event) => setDraft({ ...draft, time: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Sitting">
          <select
            className={fieldClass}
            value={draft.durationMinutes}
            onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })}
          >
            {durations.map((minutes) => (
              <option key={minutes} value={minutes}>
                {durationLabel(minutes)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Table">
          <select
            className={fieldClass}
            value={draft.tableId ?? ''}
            onChange={(event) => setDraft({ ...draft, tableId: event.target.value || null })}
          >
            <option value="">No table</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.name} · {table.seats} seats
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            className={fieldClass}
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value as BookingStatus })}
          >
            <option value="booked">Booked</option>
            <option value="seated">Seated</option>
            <option value="done">Finished</option>
            <option value="no-show">No-show</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Note">
          <textarea
            className={`${fieldClass} min-h-20 resize-none`}
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            placeholder="Birthday, high chair, window"
          />
        </Field>
        {message && <p className="mb-3 text-sm text-danger">{message}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save booking'}
        </Button>
        {onDelete && (
          <Button className="mt-2" variant="danger" onClick={() => setConfirmDelete(true)}>
            Remove booking
          </Button>
        )}
      </form>
      {pending && (
        <Confirm
          title="Save this booking?"
          body={pending.join(' ')}
          confirmLabel="Save anyway"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const next = draft
            setPending(null)
            void commit(next)
          }}
        />
      )}
      {confirmDelete && onDelete && (
        <Confirm
          title="Remove this booking?"
          body={`${draft.guestName.trim() || 'This guest'} will be taken off the book on this device.`}
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            void onDelete()
          }}
        />
      )}
    </Sheet>
  )
}
