const STAFF_KEY = 'booktrack-staff-name'

export function staffName(): string {
  try {
    return (localStorage.getItem(STAFF_KEY) ?? '').trim().slice(0, 40)
  } catch {
    return ''
  }
}

export function saveStaffName(name: string): void {
  const next = name.trim().slice(0, 40)
  try {
    if (next) localStorage.setItem(STAFF_KEY, next)
    else localStorage.removeItem(STAFF_KEY)
  } catch {
    /* The name is still typed on this screen. */
  }
}
