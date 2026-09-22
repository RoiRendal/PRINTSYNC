import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOrderEditHydration, type UseOrderEditHydrationOptions } from './useOrderEditHydration';
import { makeInventoryItem, makeOrder } from '../../../test/fixtures';

/**
 * Characterisation tests for opening an existing order on the till.
 *
 * The one thing here that must never change is *when* the version token is
 * taken: at hydration, from the order as it was found. Everything else — the
 * switch to Custom, the jump back to the terminal, clearing the request — is
 * pinned too, because each is a way this screen can surprise a cashier.
 */

const CATALOGUE = [makeInventoryItem({ id: 'item-1', name: 'Glossy Paper A4' })];
const LOADED_ORDER = makeOrder({ id: 'order-1', updatedAt: '2026-09-20T11:22:33.444Z' });

type Options = UseOrderEditHydrationOptions;

function render(initial: Partial<Options> = {}) {
  const calls = {
    setView: vi.fn(),
    setPosMode: vi.fn(),
    hydrateFromOrder: vi.fn(),
    navigate: vi.fn(),
  };
  const view = renderHook(
    (props: Partial<Options>) =>
      useOrderEditHydration({
        editOrderId: null,
        orders: [LOADED_ORDER],
        inventory: CATALOGUE,
        ...calls,
        ...props,
      }),
    { initialProps: initial },
  );
  return { ...view, ...calls };
}

describe('useOrderEditHydration', () => {
  it('does nothing when the till was not asked to open an order', () => {
    const { hydrateFromOrder, navigate } = render({ editOrderId: null });

    expect(hydrateFromOrder).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('waits for the order store instead of dropping the request', () => {
    const { hydrateFromOrder, navigate } = render({ editOrderId: 'order-99', orders: [] });

    expect(hydrateFromOrder).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('loads the order, switches to Custom and shows the terminal', () => {
    const { setView, setPosMode, hydrateFromOrder, navigate } = render({
      editOrderId: 'order-1',
      orders: [LOADED_ORDER],
    });

    expect(setView).toHaveBeenCalledWith('pos');
    expect(setPosMode).toHaveBeenCalledWith('custom');
    // The order handed over is the one found in the store, together with the
    // catalogue available at that moment — the version is taken inside.
    expect(hydrateFromOrder).toHaveBeenCalledWith(LOADED_ORDER, CATALOGUE);
    expect(navigate).toHaveBeenCalledWith('/pos', { replace: true });
  });

  it('hydrates as soon as the order arrives', () => {
    const { rerender, hydrateFromOrder } = render({ editOrderId: 'order-1', orders: [] });

    expect(hydrateFromOrder).not.toHaveBeenCalled();

    rerender({ editOrderId: 'order-1', orders: [LOADED_ORDER] });

    expect(hydrateFromOrder).toHaveBeenCalledWith(LOADED_ORDER, CATALOGUE);
  });

  it('stops once the request has been cleared', () => {
    const { rerender, hydrateFromOrder } = render({
      editOrderId: 'order-1',
      orders: [LOADED_ORDER],
    });

    // What the `navigate` above achieves on the real page: router state is
    // replaced, so the id goes away and a later store refresh cannot rebuild the
    // cart the cashier is now editing.
    rerender({ editOrderId: null, orders: [{ ...LOADED_ORDER, updatedAt: '2026-09-21T00:00:00.000Z' }] });

    expect(hydrateFromOrder).toHaveBeenCalledTimes(1);
  });

  /*
   * Recorded, not fixed: while the id is still set, a store refresh re-hydrates.
   * In practice the window is a single commit — `navigate` clears the id in the
   * same pass — so the guard lives in the page rather than here. A hook that
   * silently ignored a re-ask would strand a genuine second request.
   */
  it('re-hydrates while the request is still outstanding', () => {
    const { rerender, hydrateFromOrder } = render({
      editOrderId: 'order-1',
      orders: [LOADED_ORDER],
    });

    rerender({ editOrderId: 'order-1', orders: [{ ...LOADED_ORDER, amount: 999 }] });

    expect(hydrateFromOrder).toHaveBeenCalledTimes(2);
  });
});
