import { useSyncExternalStore } from 'react'
import { getSyncStatus, subscribeSync, type SyncStatus } from '../lib/sync.ts'

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus)
}
