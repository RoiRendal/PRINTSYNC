import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/errors';
import type { CartItem, CreateOrder, Order } from '../types';
import { makeInventoryItem, makeTotals } from '../../../test/fixtures';
import type { PaymentTransaction } from '../api/paymentsApi';
import { usePOSCheckout, type POSCheckoutController, type UsePOSCheckoutOptions } from './usePOSCheckout';

/**
 * Characterisation tests for the till's checkout — the money path.
 *
 * Three invariants are load-bearing and must not drift: (1) the cart is frozen
 * before the sale is sent so the receipt describes what was actually sold; (2)
 * a 4xx is treated as a verdict and is NOT reconciled, while anything ambiguous
 * (network drop, 5xx) is; (3) the idempotency attempt is retired only once a sale
 * is known to have landed. These pin each one.
 */

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    ...makeInventoryItem({ id: 'item-1', name: 'Glossy Paper A4', price: 100, stock: 5 }),
    qty: 2,
    isCustom: false,
    ...overrides,
  } as CartItem;
}

function makeRawTransaction(overrides: Partial<PaymentTransaction> = {}): PaymentTransaction {
  return {
    id: 'TRX-1',
    status: 'completed',
    items: [{ itemId: 'item-1', name: 'Glossy Paper A4', quantity: 2, unitPrice: 100 }],
    subtotal: 200,
    discount: 0,
    tax: 24,
    total: 224,
    paymentMethod: 'Cash',
    paymentAmount: 224,
    date: '2026-09-21T10:00:00.000Z',
    ...overrides,
  };
}

interface Harness {
  mocks: {
    createPayment: ReturnType<typeof vi.fn>;
    addOrder: ReturnType<typeof vi.fn>;
    updateOrder: ReturnType<typeof vi.fn>;
    recordCommitted: ReturnType<typeof vi.fn>;
    reconcileAttempt: ReturnType<typeof vi.fn>;
    refreshInventory: ReturnType<typeof vi.fn>;
    recordCompletedSale: ReturnType<typeof vi.fn>;
    beginAttempt: ReturnType<typeof vi.fn>;
    peekAttempt: ReturnType<typeof vi.fn>;
    completeAttempt: ReturnType<typeof vi.fn>;
    onAutoDismiss: ReturnType<typeof vi.fn>;
  };
}

function renderCheckout(overrides: Partial<UsePOSCheckoutOptions> = {}): RenderHookResult<POSCheckoutController, unknown> & Harness {
  const mocks = {
    createPayment: vi.fn(async () => makeRawTransaction()),
    addOrder: vi.fn(async (order: CreateOrder) => ({ ...order, id: 'ORD-1' }) as Order),
    updateOrder: vi.fn(async (id: string, order: CreateOrder) => ({ ...order, id }) as Order),
    recordCommitted: vi.fn(),
    reconcileAttempt: vi.fn(async () => ({ kind: 'committed', reference: 'TRX-1' }) as const),
    refreshInventory: vi.fn(),
    recordCompletedSale: vi.fn(),
    beginAttempt: vi.fn(() => 'attempt-key'),
    peekAttempt: vi.fn(() => 'attempt-key'),
    completeAttempt: vi.fn(),
    onAutoDismiss: vi.fn(),
  };

  const options: UsePOSCheckoutOptions = {
    cart: [makeCartItem()],
    totals: makeTotals({ subtotal: 200, discount: 0, tax: 24, total: 224 }),
    posMode: 'retail',
    customerName: 'Cust',
    customerId: null,
    orderNotes: '',
    editingOrderId: null,
    editingOrderVersion: null,
    orders: [],
    ...mocks,
    ...overrides,
  };

  const hook = renderHook(() => usePOSCheckout(options));
  return { ...hook, mocks };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('a retail sale', () => {
  it('records the committed transaction, retires the attempt, and shows success', async () => {
    const { result, mocks } = renderCheckout();

    await act(async () => {
      await result.current.finalize();
    });

    expect(mocks.beginAttempt).toHaveBeenCalledOnce();
    expect(mocks.completeAttempt).toHaveBeenCalledOnce();
    expect(mocks.createPayment).toHaveBeenCalledOnce();
    expect(mocks.recordCommitted).toHaveBeenCalledWith(makeRawTransaction());
    // The receipt is filed from the frozen cart, not the live one.
    expect(mocks.recordCompletedSale).toHaveBeenCalledOnce();
    expect(result.current.checkoutSuccess).toBe(true);
    expect(result.current.checkoutError).toBeNull();
  });

  it('closes the dialog after two seconds', async () => {
    const { result, mocks } = renderCheckout();

    await act(async () => {
      await result.current.finalize();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mocks.onAutoDismiss).toHaveBeenCalledOnce();
    expect(result.current.checkoutSuccess).toBe(false);
  });

  it('is a no-op on an empty cart', async () => {
    const { result, mocks } = renderCheckout({ cart: [] });

    await act(async () => {
      await result.current.finalize();
    });

    expect(mocks.createPayment).not.toHaveBeenCalled();
    expect(mocks.beginAttempt).not.toHaveBeenCalled();
    expect(result.current.checkoutSuccess).toBe(false);
  });
});

describe('a custom order', () => {
  it('creates the order and never touches the payment attempt', async () => {
    const { result, mocks } = renderCheckout({ posMode: 'custom' });

    await act(async () => {
      await result.current.finalize();
    });

    expect(mocks.addOrder).toHaveBeenCalledOnce();
    expect(mocks.createPayment).not.toHaveBeenCalled();
    expect(mocks.beginAttempt).not.toHaveBeenCalled();
    expect(mocks.completeAttempt).not.toHaveBeenCalled();
    expect(mocks.recordCompletedSale).toHaveBeenCalledOnce();
  });

  it('refuses to ring up a custom order with no customer name', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result, mocks } = renderCheckout({ posMode: 'custom', customerName: '' });

    await act(async () => {
      await result.current.finalize();
    });

    expect(alertSpy).toHaveBeenCalledOnce();
    expect(mocks.addOrder).not.toHaveBeenCalled();
  });
});

describe('a failed checkout', () => {
  it('reconciles an ambiguous failure (5xx) and recovers the sale', async () => {
    const { result, mocks } = renderCheckout({
      createPayment: vi.fn(async () => {
        throw new ApiError('gateway timeout', 504, {});
      }),
    });

    await act(async () => {
      await result.current.finalize();
    });

    expect(mocks.peekAttempt).toHaveBeenCalledOnce();
    expect(mocks.reconcileAttempt).toHaveBeenCalledWith('attempt-key');
    // A reconciled sale is still a sale: the key is retired and a receipt filed.
    expect(mocks.completeAttempt).toHaveBeenCalledOnce();
    expect(mocks.recordCompletedSale).toHaveBeenCalledOnce();
    expect(result.current.checkoutSuccess).toBe(true);
    expect(result.current.checkoutRecovered).toBe(true);
  });

  it('does NOT reconcile a 4xx — the server already refused, nothing to find', async () => {
    const { result, mocks } = renderCheckout({
      createPayment: vi.fn(async () => {
        throw new ApiError('conflict', 409, { code: 'INSUFFICIENT_STOCK' });
      }),
    });

    await act(async () => {
      await result.current.finalize();
    });

    expect(mocks.reconcileAttempt).not.toHaveBeenCalled();
    expect(mocks.completeAttempt).not.toHaveBeenCalled();
    expect(result.current.checkoutSuccess).toBe(false);
    expect(result.current.checkoutError).not.toBeNull();
  });

  it('pulls fresh stock when the refusal was a stock shortfall', async () => {
    const { result, mocks } = renderCheckout({
      createPayment: vi.fn(async () => {
        throw new ApiError('no stock', 409, {
          error: {
            code: 'INSUFFICIENT_STOCK',
            details: { itemId: 'item-1', itemName: 'Glossy Paper A4', available: 1, requested: 2 },
          },
        });
      }),
    });

    await act(async () => {
      await result.current.finalize();
    });

    expect(mocks.refreshInventory).toHaveBeenCalledOnce();
    expect(mocks.reconcileAttempt).not.toHaveBeenCalled();
  });
});
