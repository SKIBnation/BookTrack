import { useState, type FormEvent } from 'react'
import { Button, fieldClass } from './ui.tsx'
import { unlock } from '../lib/api.ts'

export function LockScreen({ onUnlocked }: { onUnlocked: () => Promise<string | null> }) {
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage(null)
    const error = await unlock(password, remember)
    if (error) {
      setMessage(error)
      setBusy(false)
      return
    }
    setPassword('')
    const after = await onUnlocked()
    if (after) setMessage(after)
    setBusy(false)
  }

  return (
    <div className="app-frame mx-auto flex max-w-[480px] flex-col justify-center bg-black px-6 text-white">
      <div className="book-mark" aria-hidden="true" />
      <h1 className="mt-6 text-[32px] leading-none font-semibold tracking-tight">BookTrack</h1>
      <p className="mt-3 text-sm leading-6 text-white/70">Enter the password to open the shared book.</p>
      <form className="mt-6" onSubmit={(event) => void onSubmit(event)}>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.14em] text-white/50">Password</span>
          <input
            className={`${fieldClass} border border-white/10 bg-white/5 text-white`}
            type="password"
            name="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label className="mb-4 flex items-center gap-3 text-sm text-white/80">
          <input
            type="checkbox"
            className="h-6 w-6 rounded accent-[#30d158]"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          Remember device
        </label>
        {message && <p className="mb-3 text-sm text-[#ff453a]">{message}</p>}
        <Button type="submit" disabled={busy || password.length === 0}>
          {busy ? 'Checking…' : 'Open the book'}
        </Button>
      </form>
    </div>
  )
}
