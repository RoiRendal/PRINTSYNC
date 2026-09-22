import { useEffect } from 'react';
import type { InventoryItem } from '../../inventory/types';
import type { Order } from '../types';
import type { PosMode } from './usePOSCart';

export interface UseOrderEditHydrationOptions {
  /**
   * The order the Orders page asked the till to rework, or `null`.
   *
   * Passed as an id rather than as router state: the state object is a new
   * reference on every navigation, which would re-run this effect on each one.
   */
  editOrderId: string | null;
  orders: Order[];
  inventory: InventoryItem[];
  /** Clears the request so a later refresh cannot re-hydrate over the cashier's edits. */
  navigate: (path: string, options?: { replace?: boolean }) => void;
  setView: (view: 'pos' | 'history') => void;
  setPosMode: (mode: PosMode) => void;
  /** Loads the order into the cart and captures its version token. */
  hydrateFromOrder: (order: Order, inventory: InventoryItem[]) => void;
}

/**
 * Loads an existing order into the till when the Orders page asks it to.
 *
 * The version token is the reason this is a hook and not a helper. The order's
 * `updatedAt` is captured **here**, at the moment of hydration, and carried on
 * the cart from then on. Reading it back off the order store at save time would
 * let a background refresh hand the form a newer version than the one it was
 * built from — which is exactly the lost update the token exists to prevent.
 *
 * Reworking an order is always a custom job, so the till is switched to Custom
 * as part of the same hydration; arriving on the History tab and finding the
 * cart silently loaded behind it would be worse than the switch.
 */
export function useOrderEditHydration({
  editOrderId,
  orders,
  inventory,
  navigate,
  setView,
  setPosMode,
  hydrateFromOrder,
}: UseOrderEditHydrationOptions): void {
  useEffect(() => {
    if (!editOrderId) return;

    // Not found yet is not the same as not asked: the order store may still be
    // loading, so the effect waits rather than dropping the request.
    const orderToEdit = orders.find((order) => order.id === editOrderId);
    if (!orderToEdit) return;

    setView('pos');
    setPosMode('custom');
    hydrateFromOrder(orderToEdit, inventory);
    navigate('/pos', { replace: true });
  }, [editOrderId, hydrateFromOrder, inventory, navigate, orders, setPosMode, setView]);
}
