export type Theme = 'dark' | 'light'

export type BookingStatus = 'booked' | 'seated' | 'done' | 'cancelled' | 'no-show'

export interface Settings {
  id: 'app'
  restaurantName: string
  theme: Theme
  timezone: string
  defaultDurationMinutes: number
  defaultPartySize: number
}

export interface DiningTable {
  id: string
  name: string
  seats: number
  sort: number
}

export interface Booking {
  id: string
  guestName: string
  phone: string
  partySize: number
  date: string
  time: string
  durationMinutes: number
  tableId: string | null
  status: BookingStatus
  notes: string
  takenBy: string
  createdAt: string
  updatedAt: string
}

export interface BookingDraft {
  guestName: string
  phone: string
  partySize: number
  date: string
  time: string
  durationMinutes: number
  tableId: string | null
  status: BookingStatus
  notes: string
}
