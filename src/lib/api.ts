import type { BookFile, BookOp } from './bookops.ts'

const SESSION_KEY = 'booktrack-session'
const CLIENT_KEY = 'booktrack-client'

let vapidKey = ''

export function apiBase(): string {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (import.meta.env.DEV) return '/api'
  return 'https://booktrack.curious-smartphone-71a.workers.dev'
}

export function hasSession(): boolean {
  return Boolean(readToken())
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* The lock screen still shows if the token cannot be cleared. */
  }
}

export function clientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    localStorage.setItem(CLIENT_KEY, created)
    return created
  } catch {
    return 'this-phone'
  }
}

export function vapidPublicKey(): string {
  return vapidKey
}

export async function unlock(password: string): Promise<string | null> {
  let response: Response
  try {
    response = await fetch(`${apiBase()}/v1/unlock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
  } catch {
    return 'The book can’t be reached. Check the connection and try again.'
  }
  if (response.status === 401) return 'That password is wrong.'
  if (response.status === 429) return 'Too many tries. Wait a few minutes and try again.'
  if (!response.ok) return 'The book can’t be reached. Check the connection and try again.'
  const body = (await response.json()) as { token?: string }
  if (!body.token) return 'The book can’t be reached. Check the connection and try again.'
  try {
    localStorage.setItem(SESSION_KEY, body.token)
  } catch {
    return 'This phone blocked site storage. Leave private browsing and try again.'
  }
  return null
}

export type RemoteResult = { ok: true; book: BookFile } | { ok: false; reason: 'unauthorized' | 'offline' | 'error'; error?: string }

export async function fetchBook(): Promise<RemoteResult> {
  const response = await request('/v1/book')
  if (!response) return { ok: false, reason: 'offline' }
  if (response.status === 401) return { ok: false, reason: 'unauthorized' }
  if (!response.ok) return { ok: false, reason: 'error' }
  const body = (await response.json()) as BookFile & { vapidPublicKey?: string }
  if (typeof body.vapidPublicKey === 'string') vapidKey = body.vapidPublicKey
  return { ok: true, book: { revision: body.revision, settings: body.settings, tables: body.tables, bookings: body.bookings } }
}

export async function commitOp(op: BookOp): Promise<BookFile | string> {
  const response = await request('/v1/op', {
    method: 'POST',
    body: JSON.stringify({ clientId: clientId(), op }),
  })
  if (!response) return 'The other phone can’t be reached. Check the connection and try again.'
  if (response.status === 401) {
    clearSession()
    return 'The book locked itself. Enter the password again.'
  }
  const body = (await response.json().catch(() => null)) as { book?: BookFile; error?: string; vapidPublicKey?: string } | null
  if (body?.vapidPublicKey) vapidKey = body.vapidPublicKey
  if (!response.ok || !body?.book) return body?.error || 'Couldn’t save that.'
  return body.book
}

export async function registerPush(subscription: PushSubscriptionJSON): Promise<void> {
  await request('/v1/push', {
    method: 'POST',
    body: JSON.stringify({ clientId: clientId(), subscription }),
  })
}

async function request(path: string, init: RequestInit = {}): Promise<Response | null> {
  const token = readToken()
  if (!token) return null
  try {
    return await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    })
  } catch {
    return null
  }
}

function readToken(): string {
  try {
    return localStorage.getItem(SESSION_KEY) ?? ''
  } catch {
    return ''
  }
}
