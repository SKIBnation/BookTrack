import { commitOp, fetchBook, hasSession, loadSession } from './api.ts'
import type { BookFile } from './bookops.ts'
import { readLocalBook, replaceFromServer } from './db.ts'
import { enqueue } from './turn.ts'

export type SyncStatus = 'unknown' | 'live' | 'offline'

let status: SyncStatus = 'unknown'
let revision = -1
const listeners = new Set<() => void>()

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function bootstrap(): Promise<'ready' | 'locked' | 'offline'> {
  if (!(await loadSession())) return 'locked'
  const remote = await fetchBook()
  if (!remote.ok) {
    if (remote.reason === 'unauthorized') return 'locked'
    setStatus('offline')
    return 'offline'
  }
  if (remote.book.bookings.length === 0) {
    const local = await readLocalBook()
    if (local.bookings.length > 0) {
      const seeded = await commitOp({ type: 'seed', settings: local.settings, tables: local.tables, bookings: local.bookings })
      if (typeof seeded !== 'string') {
        await adopt(seeded)
        setStatus('live')
        return 'ready'
      }
      const again = await fetchBook()
      if (again.ok && again.book.bookings.length > 0) {
        await adopt(again.book)
        setStatus('live')
        return 'ready'
      }
      setStatus('offline')
      return 'offline'
    }
  }
  await adopt(remote.book)
  setStatus('live')
  return 'ready'
}

export function startSync(onLocked: () => void): () => void {
  let stopped = false
  const tick = () => {
    if (stopped) return
    void enqueue(async () => {
      if (stopped || !hasSession()) return
      const remote = await fetchBook()
      if (!remote.ok) {
        if (remote.reason === 'unauthorized') onLocked()
        else setStatus('offline')
        return
      }
      setStatus('live')
      if (remote.book.revision !== revision) await adopt(remote.book)
    })
  }
  const timer = window.setInterval(tick, 3000)
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    stopped = true
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

async function adopt(book: BookFile): Promise<void> {
  await replaceFromServer(book)
  revision = book.revision
}

function setStatus(next: SyncStatus): void {
  if (status === next) return
  status = next
  for (const listener of listeners) listener()
}
