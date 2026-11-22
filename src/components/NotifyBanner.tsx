import { useState } from 'react'
import { enableNotifications } from '../lib/push.ts'
import { isIos, isStandalone } from '../lib/platform.ts'

export function NotifyBanner() {
  const [message, setMessage] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  if (hidden || !('Notification' in window) || Notification.permission === 'granted') return null
  const iphoneInstall = isIos() && !isStandalone()

  return (
    <div className="mb-4 rounded-[24px] border border-stroke bg-card px-4 py-4">
      <p className="font-medium">Hear about the book</p>
      <p className="mt-1 text-sm leading-5 text-muted">
        {iphoneInstall
          ? 'Add BookTrack to the Home Screen and open it from that icon. Then this phone can ping you when the other person adds, moves, seats, or cancels a booking.'
          : 'Turn on notifications so this phone pings you when the other person adds, moves, seats, or cancels a booking, even if BookTrack is closed.'}
      </p>
      {message && <p className="mt-2 text-sm text-danger">{message}</p>}
      {!iphoneInstall && Notification.permission !== 'denied' && (
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-gain"
          onClick={() => {
            void enableNotifications().then((error) => {
              setMessage(error)
              if (!error) setHidden(true)
            })
          }}
        >
          Turn on notifications
        </button>
      )}
    </div>
  )
}
