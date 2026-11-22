import type { Settings, Theme } from '../types.ts'

export const SETTINGS_ID = 'app' as const

export const DURATION_OPTIONS = [45, 60, 75, 90, 120, 150, 180]

export function deviceTimezone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (zone && isTimezone(zone)) return zone
  } catch {
    /* Fall back to London when the device zone cannot be read. */
  }
  return 'Europe/London'
}

export function defaultSettings(timezone = deviceTimezone()): Settings {
  return {
    id: SETTINGS_ID,
    restaurantName: 'My restaurant',
    theme: 'dark',
    timezone: isTimezone(timezone) ? timezone : 'Europe/London',
    defaultDurationMinutes: 90,
    defaultPartySize: 2,
  }
}

export function normalizeSettings(value: Partial<Settings> | null | undefined): Settings {
  const requested = typeof value?.timezone === 'string' ? value.timezone : ''
  const timezone = isTimezone(requested) ? requested : deviceTimezone()
  const base = defaultSettings(timezone)
  const theme: Theme = value?.theme === 'light' ? 'light' : 'dark'
  const name = typeof value?.restaurantName === 'string' ? value.restaurantName.trim().slice(0, 80) : ''
  return {
    id: SETTINGS_ID,
    restaurantName: name || base.restaurantName,
    theme,
    timezone: base.timezone,
    defaultDurationMinutes: clampInt(value?.defaultDurationMinutes, 15, 360, base.defaultDurationMinutes),
    defaultPartySize: clampInt(value?.defaultPartySize, 1, 40, base.defaultPartySize),
  }
}

export function rememberTheme(theme: Theme): void {
  try {
    localStorage.setItem('booktrack-theme', theme)
  } catch {
    /* The theme is still stored in IndexedDB. */
  }
}

export function isTimezone(zone: string): boolean {
  if (!zone) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: zone })
    return true
  } catch {
    return false
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(number)) return fallback
  return Math.min(max, Math.max(min, number))
}
