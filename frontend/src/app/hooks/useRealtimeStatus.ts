import { useSyncExternalStore } from 'react';
import {
  getRealtimeSnapshot,
  subscribeToRealtimeStatus,
  type RealtimeSnapshot,
} from '../../shared/realtime/eventStream';

/**
 * Reads the live-connection state for the UI indicator.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect` because the value
 * is owned by a module singleton, not by this component: several components can
 * read it at once, and a value read during the initial render must not tear.
 */
export function useRealtimeStatus(): RealtimeSnapshot {
  return useSyncExternalStore(subscribeToRealtimeStatus, getRealtimeSnapshot);
}
