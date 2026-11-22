import { useState } from 'react'
import type { Booking, BookingDraft } from '../types.ts'
import { blankDraft, draftFromBooking } from '../lib/bookings.ts'
import { deleteBooking, saveBooking } from '../lib/db.ts'
import { useBookData } from './useBookData.tsx'

export function useBookingEditor() {
  const { settings, today, date, chooseDate } = useBookData()
  const [form, setForm] = useState<{ id?: string; draft: BookingDraft } | null>(null)

  function add(forDate = date) {
    setForm({ draft: blankDraft(forDate, settings, today) })
  }

  function edit(booking: Booking) {
    setForm({ id: booking.id, draft: draftFromBooking(booking) })
  }

  async function save(draft: BookingDraft) {
    const error = await saveBooking(draft, form?.id)
    if (!error) chooseDate(draft.date)
    return error
  }

  async function remove() {
    if (form?.id) await deleteBooking(form.id)
    setForm(null)
  }

  return { form, close: () => setForm(null), add, edit, save, remove }
}
