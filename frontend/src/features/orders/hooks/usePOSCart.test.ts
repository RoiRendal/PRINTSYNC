import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePOSCart } from './usePOSCart';
import { makeInventoryItem, makeOrder } from '../../../test/fixtures';

/**
 * Characterisation tests for the basket.
 *
 * These pin what `POSPage` already did before the move — including two quirks
 * that are worth stating out loud because they look like bugs and are not being
 * changed here:
 *
 *   - Hydrating a legacy order (one with no `lineItems`) gives **every** line the
 *     order's total quantity, not an even split.
 *   - "Reset" on the cart panel leaves an order being edited alone, while
 *     switching the till between Retail and Custom drops it.
 *
 * If one of these fails after the extraction, the extraction moved something.
 */

const PAPER = makeInventoryItem({ id: 'item-1', name: 'Glossy Paper A4', stock: 3, price: 100 });
const STAPLER = makeInventoryItem({ id: 'item-2', name: 'Stapler', stock: 50, price: 25 });
const CATALOGUE = [PAPER, STAPLER];

function renderCart(vatRate = 12) {
  return renderHook(() => usePOSCart({ inventory: CATALOGUE, vatRate }));
}

describe('usePOSCart', () => {
  it('starts empty, at the shop VAT rate, with no order attached', () => {
    const { result } = renderCart(12);

    expect(result.current.cart).toEqual([]);
    expect(result.current.vatRatePercent).toBe(12);
    expect(result.current.cartDiscount).toBe(0);
    expect(result.current.editingOrderId).toBeNull();
    expect(result.current.editingOrderVersion).toBeNull();
  });

  it('follows the shop VAT rate when it changes', () => {
    const { result, rerender } = renderHook(({ vatRate }) => usePOSCart({ inventory: CATALOGUE, vatRate }), {
      initialProps: { vatRate: 12 },
    });

    rerender({ vatRate: 5 });

    expect(result.current.vatRatePercent).toBe(5);
  });

  describe('addToCart', () => {
    it('adds a line of one, marked retail', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'retail'));

      expect(result.current.cart).toHaveLength(1);
      expect(result.current.cart[0]).toMatchObject({ id: 'item-1', qty: 1, isCustom: false });
    });

    it('marks the line custom when the till is in Custom mode', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'custom'));

      expect(result.current.cart[0]?.isCustom).toBe(true);
    });

    it('refuses a product with no stock', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(makeInventoryItem({ id: 'item-9', stock: 0 }), 'retail'));

      expect(result.current.cart).toEqual([]);
    });

    it('merges a second retail scan into the existing line', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'retail'));
      act(() => result.current.addToCart(PAPER, 'retail'));

      expect(result.current.cart).toHaveLength(1);
      expect(result.current.cart[0]?.qty).toBe(2);
    });

    it('will not take a retail line past what is on the shelf', () => {
      const { result } = renderCart();

      for (let i = 0; i < 5; i += 1) {
        act(() => result.current.addToCart(PAPER, 'retail'));
      }

      expect(result.current.cart[0]?.qty).toBe(3);
    });

    it('does not merge into a custom line for the same product', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'custom'));
      act(() => result.current.addToCart(PAPER, 'retail'));

      expect(result.current.cart).toHaveLength(2);
      expect(result.current.cart.map((item) => item.isCustom)).toEqual([true, false]);
    });

    it('always appends a new line in Custom mode', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'custom'));
      act(() => result.current.addToCart(PAPER, 'custom'));

      expect(result.current.cart).toHaveLength(2);
      expect(result.current.cart.every((item) => item.qty === 1)).toBe(true);
    });
  });

  describe('updateQty', () => {
    it('steps a line up', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'retail'));
      act(() => result.current.updateQty(0, 1));

      expect(result.current.cart[0]?.qty).toBe(2);
    });

    it('clamps to the stock on the shelf', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'retail'));
      act(() => result.current.updateQty(0, 10));

      expect(result.current.cart[0]?.qty).toBe(3);
    });

    it('never goes below one', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'retail'));
      act(() => result.current.updateQty(0, 1));
      act(() => result.current.updateQty(0, -5));

      expect(result.current.cart[0]?.qty).toBe(1);
    });

    it('removes the line when stepping down from one', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'retail'));
      act(() => result.current.updateQty(0, -1));

      expect(result.current.cart).toEqual([]);
    });

    it('leaves a line alone when the catalogue has no price for it', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(makeInventoryItem({ id: 'ghost', stock: 9 }), 'retail'));
      act(() => result.current.updateQty(0, 1));

      expect(result.current.cart[0]?.qty).toBe(1);
    });

    it('ignores an index that is not in the basket', () => {
      const { result } = renderCart();

      act(() => result.current.updateQty(4, 1));

      expect(result.current.cart).toEqual([]);
    });
  });

  it('removes a line by index', () => {
    const { result } = renderCart();

    act(() => result.current.addToCart(PAPER, 'retail'));
    act(() => result.current.addToCart(STAPLER, 'retail'));
    act(() => result.current.removeFromCart(0));

    expect(result.current.cart.map((item) => item.id)).toEqual(['item-2']);
  });

  describe('the discount ceiling', () => {
    it('leaves a discount typed above the subtotal alone until the basket moves', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'retail'));
      act(() => result.current.setCartDiscount(500));

      // The ceiling is re-applied when the *cart* changes, not when the discount
      // is typed — the figure shown to the cashier is clamped by `useCartTotals`
      // at render time, so an over-large number never reaches a total.
      expect(result.current.cartDiscount).toBe(500);

      act(() => result.current.addToCart(STAPLER, 'retail'));

      expect(result.current.cartDiscount).toBe(125);
    });

    it('clamps again when the basket shrinks under an existing discount', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'retail'));
      act(() => result.current.addToCart(PAPER, 'retail'));
      act(() => result.current.setCartDiscount(150));
      expect(result.current.cartDiscount).toBe(150);

      act(() => result.current.updateQty(0, -1));

      expect(result.current.cartDiscount).toBe(100);
    });
  });

  describe('the design selector', () => {
    it('attaches the chosen design to the line it was opened for', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'retail'));
      act(() => result.current.addToCart(STAPLER, 'retail'));
      act(() => result.current.openDesignSelector(1));
      expect(result.current.isDesignModalOpen).toBe(true);

      act(() => result.current.selectDesignForItem('design-7'));

      expect(result.current.cart.map((item) => item.designId)).toEqual([undefined, 'design-7']);
      expect(result.current.isDesignModalOpen).toBe(false);
    });

    it('does nothing when it was never opened', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'retail'));
      act(() => result.current.selectDesignForItem('design-7'));

      expect(result.current.cart[0]?.designId).toBeUndefined();
    });

    it('closes without touching the basket when dismissed', () => {
      const { result } = renderCart();

      act(() => result.current.addToCart(PAPER, 'retail'));
      act(() => result.current.openDesignSelector(0));
      act(() => result.current.closeDesignSelector());

      expect(result.current.isDesignModalOpen).toBe(false);
      expect(result.current.cart[0]?.designId).toBeUndefined();
    });
  });

  describe('hydrateFromOrder', () => {
    it('loads the order lines, customer and version', () => {
      const { result } = renderCart();
      const order = makeOrder({
        id: 'order-42',
        updatedAt: '2026-09-20T11:22:33.444Z',
        customer: 'Grace Hopper',
        customerId: 'cust-9',
        notes: 'Two colours',
        lineItems: [
          { itemId: 'item-1', name: 'Glossy Paper A4', quantity: 3, designId: 'design-1' },
          { itemId: 'item-2', name: 'Stapler', quantity: 1 },
        ],
      });

      act(() => result.current.hydrateFromOrder(order, CATALOGUE));

      expect(result.current.customerName).toBe('Grace Hopper');
      expect(result.current.customerId).toBe('cust-9');
      expect(result.current.orderNotes).toBe('Two colours');
      expect(result.current.editingOrderId).toBe('order-42');
      // The version is the order's, taken at hydration — never a later re-read.
      expect(result.current.editingOrderVersion).toBe('2026-09-20T11:22:33.444Z');
      expect(result.current.cart).toMatchObject([
        { id: 'item-1', qty: 3, isCustom: true, designId: 'design-1', notes: 'Two colours' },
        { id: 'item-2', qty: 1, isCustom: true },
      ]);
    });

    it('falls back to the item list for an order with no line items', () => {
      const { result } = renderCart();
      const order = makeOrder({
        item: 'Glossy Paper A4, Stapler',
        quantity: 4,
        lineItems: undefined,
        updatedAt: '2026-09-20T00:00:00.000Z',
      });

      act(() => result.current.hydrateFromOrder(order, CATALOGUE));

      // Every legacy line carries the order's total quantity — not an even split.
      expect(result.current.cart.map((item) => [item.id, item.qty])).toEqual([
        ['item-1', 4],
        ['item-2', 4],
      ]);
    });

    it('drops lines the catalogue no longer carries', () => {
      const { result } = renderCart();
      const order = makeOrder({
        item: 'Glossy Paper A4, Discontinued Ink',
        lineItems: undefined,
      });

      act(() => result.current.hydrateFromOrder(order, CATALOGUE));

      expect(result.current.cart.map((item) => item.id)).toEqual(['item-1']);
    });

    it('matches a line by name when it carries no item id', () => {
      const { result } = renderCart();
      const order = makeOrder({
        lineItems: [{ name: 'glossy paper a4', quantity: 2 }],
      });

      act(() => result.current.hydrateFromOrder(order, CATALOGUE));

      expect(result.current.cart).toMatchObject([{ id: 'item-1', qty: 2 }]);
    });
  });

  describe('the three ways the basket is emptied', () => {
    it('a mode switch drops the order being edited', () => {
      const { result } = renderCart();
      const order = makeOrder();

      act(() => result.current.hydrateFromOrder(order, CATALOGUE));
      act(() => result.current.setVatRatePercent(3));
      act(() => result.current.resetForModeSwitch());

      expect(result.current.cart).toEqual([]);
      expect(result.current.editingOrderId).toBeNull();
      expect(result.current.editingOrderVersion).toBeNull();
      expect(result.current.vatRatePercent).toBe(12);
    });

    it('the cart panel reset leaves the order being edited alone', () => {
      const { result } = renderCart();
      const order = makeOrder();

      act(() => result.current.hydrateFromOrder(order, CATALOGUE));
      act(() => result.current.resetCart());

      expect(result.current.cart).toEqual([]);
      expect(result.current.editingOrderId).toBe('order-1');
    });

    it('a completed sale clears the customer and the notes as well', () => {
      const { result } = renderCart();
      const order = makeOrder();

      act(() => result.current.hydrateFromOrder(order, CATALOGUE));
      act(() => result.current.clearAfterSale());

      expect(result.current.cart).toEqual([]);
      expect(result.current.customerName).toBe('');
      expect(result.current.customerId).toBeNull();
      expect(result.current.orderNotes).toBe('');
      expect(result.current.editingOrderId).toBeNull();
      expect(result.current.editingOrderVersion).toBeNull();
    });
  });
});
