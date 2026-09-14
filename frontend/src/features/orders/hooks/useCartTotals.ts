import { useMemo } from 'react';
import type { CartItem } from '../types';

export interface CartTotals {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  tax: number;
  total: number;
  vatRatePercent: number;
}

export function useCartTotals(cart: CartItem[], cartDiscount: number, vatRatePercent: number): CartTotals {
  return useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
    const discount = Math.min(Math.max(0, cartDiscount), subtotal);
    const afterDiscount = Math.max(0, subtotal - discount);
    const rate = Math.max(0, vatRatePercent);
    const tax = afterDiscount * (rate / 100);
    const total = afterDiscount + tax;
    return { subtotal, discount, afterDiscount, tax, total, vatRatePercent: rate };
  }, [cart, cartDiscount, vatRatePercent]);
}
