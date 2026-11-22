import type { BookFile, BookOp } from './bookops.ts'

const SESSION_KEY = 'booktrack-session'
const CLIENT_KEY = 'booktrack-client'
const DEVICE_DB = 'BookTrackDevice'
const DEVICE_STORE = 'device'

let vapidKey = ''
let memoryToken = ''

export function apiBase(): string {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (import.meta.env.DEV) return '/api'
  return 'https://booktrack.curious-smartphone-71a.workers.dev'
}

export function hasSession(): boolean {
  return Boolean(memoryToken || readQuickToken())
}

export async function loadSession(): Promise<string> {
  const sessionOnly = readStorage(sessionStorage)
  if (sessionOnly) {
    memoryToken = sessionOnly
    return sessionOnly
  }
  const local = readStorage(localStorage)
  if (local) {
    memoryToken = local
    void writeDeviceToken(local)
    return local
  }
  const stored = await readDeviceToken()
  if (!stored) return ''
  memoryToken = stored
  try {
    localStorage.setItem(SESSION_KEY, stored)
  } catch {
    /* IndexedDB already has the remembered device. */
  }
  return stored
}

export async function clearSession(): Promise<void> {
  memoryToken = ''
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* Session storage can be blocked in private browsing. */
  }
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* The lock screen still shows if the token cannot be cleared. */
  }
  await writeDeviceToken(null)
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

export async function unlock(password: string, remember: boolean): Promise<string | null> {
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
  memoryToken = body.token
  if (remember) {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* A remembered device uses the longer-lived store. */
    }
    try {
      localStorage.setItem(SESSION_KEY, body.token)
    } catch {
      /* IndexedDB is the copy that survives an iPhone restart. */
    }
    await writeDeviceToken(body.token)
    return null
  }
  await writeDeviceToken(null)
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* This open still keeps the session until the app closes. */
  }
  try {
    sessionStorage.setItem(SESSION_KEY, body.token)
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
  const token = memoryToken || readQuickToken()
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

function readQuickToken(): string {
  return readStorage(sessionStorage) || readStorage(localStorage)
}

function readStorage(storage: Storage): string {
  try {
    return storage.getItem(SESSION_KEY) ?? ''
  } catch {
    return ''
  }
}

function deviceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DEVICE_DB, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DEVICE_STORE)) request.result.createObjectStore(DEVICE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function writeDeviceToken(token: string | null): Promise<void> {
  try {
    const database = await deviceDb()
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(DEVICE_STORE, 'readwrite')
      const store = tx.objectStore(DEVICE_STORE)
      if (token) store.put(token, 'session')
      else store.delete('session')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    database.close()
  } catch {
    /* The other stored copy is used when this one is blocked. */
  }
}

async function readDeviceToken(): Promise<string> {
  try {
    const database = await deviceDb()
    const token = await new Promise<string>((resolve, reject) => {
      const request = database.transaction(DEVICE_STORE, 'readonly').objectStore(DEVICE_STORE).get('session')
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : '')
      request.onerror = () => reject(request.error)
    })
    database.close()
    return token
  } catch {
    return ''
  }
}
