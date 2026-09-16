import { useEffect, useState } from 'react';
import { useCustomerStore } from '../stores/useCustomerStore';
import { useDesignStore } from '../stores/useDesignStore';
import { useInventoryStore } from '../stores/useInventoryStore';
import { useOrderStore } from '../stores/useOrderStore';
import { useUserStore } from '../stores/useUserStore';

/**
 * How long a background refresh must run before it is worth mentioning.
 *
 * Every domain event starts one of these, and on a shop LAN they usually finish
 * in tens of milliseconds. Reporting those would make the indicator flicker on
 * every change anywhere in the system — and an indicator that flickers constantly
 * is one staff learn to ignore, which defeats the point of having it. A refresh
 * still running after this long is genuinely worth knowing about, because it
 * means the screen is showing numbers that are about to change.
 */
export const SYNC_INDICATOR_DELAY_MS = 400;

/** `true` while any loaded collection is being refreshed in the background. */
function useAnyStoreRevalidating(): boolean {
  const orders = useOrderStore((state) => state.isRevalidating);
  const inventory = useInventoryStore((state) => state.isRevalidating);
  const customers = useCustomerStore((state) => state.isRevalidating);
  const designs = useDesignStore((state) => state.isRevalidating);
  const users = useUserStore((state) => state.isRevalidating);
  return orders || inventory || customers || designs || users;
}

/**
 * Whether to show the "syncing" state on the connection chip.
 *
 * `isRevalidating` has existed on every list store since the freshness model was
 * built and was never rendered anywhere — so the app refreshed itself silently
 * and staff had no way to tell a current screen from one that had quietly stopped
 * updating. This is what surfaces it.
 *
 * Deliberately debounced rather than shown on the first frame: see
 * `SYNC_INDICATOR_DELAY_MS`. It reports a *slow* refresh, not every refresh.
 *
 * It is also deliberately not a loading state. Nothing is blocked and nothing is
 * blanked — the data on screen stays usable throughout, which is the entire
 * reason the background refresh path exists.
 */
export function useIsSyncing(delayMs: number = SYNC_INDICATOR_DELAY_MS): boolean {
  const revalidating = useAnyStoreRevalidating();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!revalidating) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    // Cleared on unmount and on the refresh finishing, so a fast refresh never
    // reaches the point of showing anything at all.
    return () => window.clearTimeout(timer);
  }, [revalidating, delayMs]);

  return visible;
}
