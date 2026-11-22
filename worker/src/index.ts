import { buildPushPayload, type PushSubscription as WebPushSubscription } from '@block65/webcrypto-web-push'
import { DurableObject } from 'cloudflare:workers'
import { applyBookOp, emptyBook, type BookFile, type BookOp, type BookOpResult } from '../../src/lib/bookops.ts'

interface Env {
  BOOK: DurableObjectNamespace
  BOOK_PASSWORD: string
  SESSION_SECRET: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
}

interface PushSub {
  clientId: string
  endpoint: string
  p256dh: string
  auth: string
  updatedAt: string
}

interface Attempt {
  failures: number
  resetAt: number
}

const WINDOW_MS = 15 * 60 * 1000
const MAX_TRIES = 8
const MAX_BODY = 1_000_000

export class BookRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/v1/health' && request.method === 'GET') return json({ ok: true })
    if (url.pathname === '/v1/unlock' && request.method === 'POST') return this.unlock(request)
    const token = bearer(request)
    if (!token || !(await validToken(token, this.env.SESSION_SECRET))) return json({ error: 'Locked.' }, 401)
    if (url.pathname === '/v1/book' && request.method === 'GET') return this.readBook()
    if (url.pathname === '/v1/op' && request.method === 'POST') return this.writeOp(request)
    if (url.pathname === '/v1/push' && request.method === 'POST') return this.savePush(request)
    return json({ error: 'Not found.' }, 404)
  }

  private async unlock(request: Request): Promise<Response> {
    if (!this.env.BOOK_PASSWORD || !this.env.SESSION_SECRET) return json({ error: 'The book isn’t ready.' }, 500)
    const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
    const ipHash = await digest(`${this.env.SESSION_SECRET}:${ip}`)
    if (await this.tooManyTries(ipHash)) return json({ error: 'Too many tries.' }, 429)
    const body = await readJson(request)
    const password = body && typeof body.password === 'string' ? body.password : ''
    if (password.length === 0 || password.length > 200 || !safeEqual(password, this.env.BOOK_PASSWORD)) {
      await this.noteFailure(ipHash)
      return json({ error: 'Wrong password.' }, 401)
    }
    const attempts = await this.attempts()
    delete attempts[ipHash]
    await this.ctx.storage.put('attempts', attempts)
    return json({ token: await signToken(this.env.SESSION_SECRET) })
  }

  private async readBook(): Promise<Response> {
    return json({ ...(await this.book()), vapidPublicKey: this.env.VAPID_PUBLIC_KEY ?? '' })
  }

  private async writeOp(request: Request): Promise<Response> {
    const body = await readJson(request)
    const op = body?.op as BookOp | undefined
    const clientId = typeof body?.clientId === 'string' ? body.clientId.slice(0, 80) : ''
    if (!op || typeof op !== 'object' || typeof op.type !== 'string') return json({ error: 'That change isn’t recognised.' }, 400)
    const current = await this.book()
    const applied = applyBookOp(current, op)
    if (applied.error) return json({ error: applied.error, book: current, vapidPublicKey: this.env.VAPID_PUBLIC_KEY ?? '' }, 400)
    await this.ctx.storage.put('book', applied.book)
    if (applied.notify) await this.sendNotice(applied, clientId)
    return json({ book: applied.book, vapidPublicKey: this.env.VAPID_PUBLIC_KEY ?? '' })
  }

  private async savePush(request: Request): Promise<Response> {
    const body = await readJson(request)
    const clientId = typeof body?.clientId === 'string' ? body.clientId.trim().slice(0, 80) : ''
    const subscription = body?.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined
    const endpoint = subscription?.endpoint ?? ''
    const p256dh = subscription?.keys?.p256dh ?? ''
    const auth = subscription?.keys?.auth ?? ''
    if (!clientId || !endpoint.startsWith('https://') || !p256dh || !auth) return json({ error: 'That notification registration is incomplete.' }, 400)
    const subs = (await this.ctx.storage.get<PushSub[]>('push')) ?? []
    const next = [
      { clientId, endpoint, p256dh, auth, updatedAt: new Date().toISOString() },
      ...subs.filter((item) => item.clientId !== clientId),
    ].slice(0, 10)
    await this.ctx.storage.put('push', next)
    return json({ ok: true })
  }

  private async book(): Promise<BookFile> {
    return (await this.ctx.storage.get<BookFile>('book')) ?? emptyBook()
  }

  private async attempts(): Promise<Record<string, Attempt>> {
    return (await this.ctx.storage.get<Record<string, Attempt>>('attempts')) ?? {}
  }

  private async tooManyTries(ipHash: string): Promise<boolean> {
    const row = (await this.attempts())[ipHash]
    if (!row) return false
    if (Date.now() > row.resetAt) return false
    return row.failures >= MAX_TRIES
  }

  private async noteFailure(ipHash: string): Promise<void> {
    const attempts = await this.attempts()
    const now = Date.now()
    const row = attempts[ipHash]
    if (!row || now > row.resetAt) attempts[ipHash] = { failures: 1, resetAt: now + WINDOW_MS }
    else attempts[ipHash] = { failures: row.failures + 1, resetAt: row.resetAt }
    await this.ctx.storage.put('attempts', attempts)
  }

  private async sendNotice(applied: BookOpResult, clientId: string): Promise<void> {
    if (!applied.notify || !this.env.VAPID_PRIVATE_KEY || !this.env.VAPID_PUBLIC_KEY) return
    const subs = (await this.ctx.storage.get<PushSub[]>('push')) ?? []
    const notice = applied.notify
    await Promise.all(
      subs
        .filter((row) => row.clientId !== clientId)
        .map(async (row) => {
          const subscription: WebPushSubscription = {
            endpoint: row.endpoint,
            expirationTime: null,
            keys: { p256dh: row.p256dh, auth: row.auth },
          }
          try {
            const payload = await buildPushPayload(
              { data: JSON.stringify(notice), options: { ttl: 12 * 60 * 60, urgency: 'high', topic: notice.tag } },
              subscription,
              {
                subject: this.env.VAPID_SUBJECT || 'https://skibnation.github.io/BookTrack/',
                publicKey: this.env.VAPID_PUBLIC_KEY,
                privateKey: this.env.VAPID_PRIVATE_KEY,
              },
            )
            const response = await fetch(row.endpoint, payload)
            if (response.status === 404 || response.status === 410) {
              const remaining = ((await this.ctx.storage.get<PushSub[]>('push')) ?? []).filter((item) => item.clientId !== row.clientId)
              await this.ctx.storage.put('push', remaining)
            }
          } catch {
            /* A failed ping must not undo the booking. */
          }
        }),
    )
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request.headers.get('Origin'))
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), origin)
    try {
      const room = env.BOOK.get(env.BOOK.idFromName('shared-book'))
      return withCors(await room.fetch(request), origin)
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'request failed')
      return withCors(json({ error: 'Something went wrong.' }, 500), origin)
    }
  },
}

async function signToken(secret: string): Promise<string> {
  const payload = base64url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, v: 1 }))
  return `${payload}.${await hmac(secret, payload)}`
}

async function validToken(token: string, secret: string): Promise<boolean> {
  if (!secret) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  const expected = await hmac(secret, payload)
  if (!safeEqual(signature, expected)) return false
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const parsed = JSON.parse(atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4))) as { exp?: number }
    return typeof parsed.exp === 'number' && parsed.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return base64urlBytes(new Uint8Array(signature))
}

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return base64urlBytes(new Uint8Array(hash))
}

function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left)
  const b = new TextEncoder().encode(right)
  const length = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let index = 0; index < length; index += 1) diff |= (a[index] ?? 0) ^ (b[index] ?? 0)
  return diff === 0
}

function bearer(request: Request): string {
  const header = request.headers.get('Authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const raw = await request.text()
  if (raw.length > MAX_BODY) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function withCors(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers)
  if (origin) {
    headers.set('access-control-allow-origin', origin)
    headers.set('vary', 'Origin')
  }
  headers.set('access-control-allow-headers', 'authorization, content-type')
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS')
  headers.set('access-control-max-age', '86400')
  return new Response(response.body, { status: response.status, headers })
}

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null
  if (origin === 'https://skibnation.github.io') return origin
  if (/^https:\/\/booktrack\.[a-z0-9-]+\.workers\.dev$/.test(origin)) return origin
  if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return origin
  return null
}

function base64url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64urlBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return base64url(binary)
}
