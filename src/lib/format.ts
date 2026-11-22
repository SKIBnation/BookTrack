import type { BookingStatus } from '../types.ts'

export function guestLabel(count: number): string {
  return `${count} ${count === 1 ? 'guest' : 'guests'}`
}

export function statusLabel(status: BookingStatus): string {
  if (status === 'done') return 'Finished'
  if (status === 'no-show') return 'No-show'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'seated') return 'Seated'
  return 'Booked'
}

export function durationLabel(minutes: number): string {
  if (minutes > 0 && minutes % 60 === 0) {
    const hours = minutes / 60
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  return `${minutes} min`
}

export function telHref(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.replace(/\D/g, '').length < 3) return null
  return `tel:${cleaned}`
}
