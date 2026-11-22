import { registerPush, vapidPublicKey } from './api.ts'
import { isIos, isStandalone } from './platform.ts'

export async function enableNotifications(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'This phone can’t show BookTrack notifications.'
  }
  if (isIos() && !isStandalone()) {
    return 'On iPhone, add BookTrack to the Home Screen, open it from that icon, then turn notifications on.'
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'Notifications are off. You can turn them on in the phone settings.'
  return subscribeForPush()
}

export async function ensurePushSubscription(): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  await subscribeForPush()
}

async function subscribeForPush(): Promise<string | null> {
  const key = vapidPublicKey()
  if (!key) return 'Notifications aren’t ready yet. Leave the app open for a moment and try again.'
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(key),
    }))
  await registerPush(subscription.toJSON())
  return null
}

function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}
