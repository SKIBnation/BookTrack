import { createContext, useContext, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Booking, DiningTable, Settings } from '../types.ts'
import { db } from '../lib/db.ts'
import { normalizeSettings, SETTINGS_ID } from '../lib/settings.ts'
import { todayKey } from '../lib/time.ts'

export interface BookState {
  settings: Settings
  bookings: Booking[]
  tables: DiningTable[]
  today: string
  date: string
  chooseDate: (date: string | null) => void
}

const BookContext = createContext<BookState | null>(null)

export function useLiveBookData(): {
  loading: boolean
  settings: Settings | null
  bookings: Booking[]
  tables: DiningTable[]
} {
  const settingsRow = useLiveQuery(() => db.settings.get(SETTINGS_ID))
  const bookings = useLiveQuery(() => db.bookings.toArray())
  const tables = useLiveQuery(() => db.diningTables.toArray())
  const loading = settingsRow === undefined || bookings === undefined || tables === undefined
  return {
    loading,
    settings: settingsRow ? normalizeSettings(settingsRow) : null,
    bookings: bookings ?? [],
    tables: (tables ?? []).slice().sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)),
  }
}

export function BookProvider({
  settings,
  bookings,
  tables,
  children,
}: {
  settings: Settings
  bookings: Booking[]
  tables: DiningTable[]
  children: ReactNode
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const today = todayKey(settings.timezone)
  const value: BookState = {
    settings,
    bookings,
    tables,
    today,
    date: picked ?? today,
    chooseDate: setPicked,
  }
  return <BookContext.Provider value={value}>{children}</BookContext.Provider>
}

export function useBookData(): BookState {
  const value = useContext(BookContext)
  if (!value) throw new Error('useBookData must be used inside the app shell.')
  return value
}
