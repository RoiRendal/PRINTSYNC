import { useMemo } from 'react';
import type { CartItem } from '../types';

export interface CartTotals {
  /** Gross: Σ(unit price × quantity), before any discount. */
  subtotal: number;
  /** Sum of the per-line discounts. Informational — already inside `discount`. */
  lineDiscounts: number;
  /** The cart-level discount the cashier typed, on its own. */
  cartDiscount: number;
  /**
   * The GRAND discount: line discounts plus the cart-level one, clamped to the
   * subtotal. This is what the sale RPC receives as `p_discount`, and what it
   * checks against the sum of the line discounts.
   */
  discount: number;
  afterDiscount: number;
  tax: number;
  total: number;
  vatRatePercent: number;
}

/**
 * The till's arithmetic, in one place.
 *
 * The shape is not ours to choose. `create_transaction_with_payment` enforces
 *
 *     subtotal = Σ(unit_price × quantity)
 *     discount ≥ Σ(line_discount)
 *     discount ≤ subtotal
 *     total    = subtotal − discount + tax
 *
 * so a sale rung up here is accepted there. Two properties fall out of that, and
 * both are load-bearing:
 *
 *   * **The grand discount can never fall below the line discounts.** Each line
 *     discount is clamped to its own line value, so their sum cannot exceed the
 *     subtotal — and the clamp `min(cart + lines, subtotal)` therefore always
 *     leaves at least `Σ lines`. The server's `discount ≥ Σ lines` rule cannot
 *     be tripped by anything this hook produces.
 *   * **Line discounts are not a second deduction.** They are folded into
 *     `discount`, so the form of `total` is unchanged — which is what keeps a
 *     cart with no line discounts behaving exactly as it did before the column
 *     existed.
 */
export function useCartTotals(cart: CartItem[], cartDiscount: number, vatRatePercent: number): CartTotals {
  return useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
    const lineDiscounts = cart.reduce((acc, item) => acc + (item.lineDiscount ?? 0), 0);
    const typed = Math.max(0, cartDiscount);
    const discount = Math.min(typed + lineDiscounts, subtotal);
    const afterDiscount = Math.max(0, subtotal - discount);
    const rate = Math.max(0, vatRatePercent);
    const tax = afterDiscount * (rate / 100);
    const total = afterDiscount + tax;
    return {
      subtotal,
      lineDiscounts,
      cartDiscount: typed,
      discount,
      afterDiscount,
      tax,
      total,
      vatRatePercent: rate,
    };
  }, [cart, cartDiscount, vatRatePercent]);
}
