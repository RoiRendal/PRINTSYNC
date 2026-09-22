import type { InsufficientStockDetails } from '@printsync/shared-types';
import type { InventoryItem } from '../features/inventory/types';
import type { CartItem, Order } from '../features/orders/types';
import type { CartTotals } from '../features/orders/hooks/useCartTotals';
import type { CheckoutError } from '../features/orders/components/pos/POSCheckoutModal';

/**
 * Builders for component tests.
 *
 * Each takes a `Partial` override and fills in the rest, so a test states only
 * the fields it actually cares about. That matters more than it looks: a test
 * that spells out every property of a cart item is a test that has to be edited
 * whenever an unrelated field is added, and the edit is usually a copy-paste of
 * the wrong default.
 *
 * Defaults are chosen to be *valid but unremarkable* — a real-looking product at
 * a round price — so a failing assertion points at the override rather than at
 * the fixture.
 */

export function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'item-1',
    sku: 'PP-A4-100',
    name: 'Glossy Paper A4',
    category: 'Paper',
    stock: 120,
    reorderLevel: 20,
    price: 100,
    costPrice: 0,
    imageUrl: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    qty: 2,
    ...overrides,
  };
}

export function makeInventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-1',
    sku: 'PP-A4-100',
    name: 'Glossy Paper A4',
    category: 'Paper',
    stock: 120,
    reorderLevel: 20,
    price: 100,
    costPrice: 0,
    imageUrl: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customer: 'Ada Lovelace',
    item: 'Glossy Paper A4',
    // Empty by default, which exercises the same legacy `item` fallback a
    // missing list always did — the contract requires the field, not a value.
    lineItems: [],
    quantity: 2,
    status: 'Pending',
    date: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    amount: 200,
    totalPaid: 0,
    balanceDue: 200,
    notes: '',
    isCustom: false,
    ...overrides,
  };
}

export function makeTotals(overrides: Partial<CartTotals> = {}): CartTotals {
  return {
    subtotal: 200,
    discount: 0,
    afterDiscount: 200,
    tax: 24,
    total: 224,
    vatRatePercent: 12,
    ...overrides,
  };
}

export function makeInsufficientStock(
  overrides: Partial<InsufficientStockDetails> = {},
): InsufficientStockDetails {
  return {
    itemId: 'item-1',
    itemName: 'Glossy Paper A4',
    available: 3,
    requested: 5,
    ...overrides,
  };
}

export function makeCheckoutError(overrides: Partial<CheckoutError> = {}): CheckoutError {
  return {
    message: 'The transaction could not be completed.',
    stock: null,
    ...overrides,
  };
}
