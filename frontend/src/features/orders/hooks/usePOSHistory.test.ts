import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePOSHistory } from './usePOSHistory';
import { makeCartItem, makeInventoryItem, makeOrder } from '../../../test/fixtures';
import type { Transaction } from '../types';

/**
 * Characterisation tests for the history timeline.
 *
 * These pin what `POSPage` already did: an order flattened into the shape of a
 * sale, the newest-first ordering of the two sources mixed together, and the
 * three fields the search box looks at per source. One quirk is recorded rather
 * than fixed — a legacy order splits its quantity between named items, while
 * hydrating the same order into the cart does not.
 */

const PAPER = makeInventoryItem({ id: 'item-1', name: 'Glossy Paper A4', stock: 3, price: 100 });
const STAPLER = makeInventoryItem({ id: 'item-2', name: 'Stapler', stock: 50, price: 25 });
const CATALOGUE = [PAPER, STAPLER];

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'TRX-1',
    date: '2026-09-21T10:00:00.000Z',
    items: [makeCartItem()],
    subtotal: 200,
    tax: 24,
    total: 224,
    paymentMethod: 'Cash',
    ...overrides,
  };
}

function renderHistory(transactions: Transaction[], orders = [makeOrder()]) {
  return renderHook(() =>
    usePOSHistory({ transactions, orders, inventory: CATALOGUE }),
  );
}

describe('usePOSHistory', () => {
  it('starts unfiltered with nothing selected', () => {
    const { result } = renderHistory([makeTransaction()]);

    expect(result.current.historySearchTerm).toBe('');
    expect(result.current.selectedTransaction).toBeNull();
  });

  describe('orderToHistoryTransaction', () => {
    it('reads a modern order from its line items', () => {
      const { result } = renderHistory([]);
      const order = makeOrder({
        id: 'order-7',
        date: '2026-09-20T09:00:00.000Z',
        amount: 500,
        notes: 'Rush job',
        lineItems: [
          { itemId: 'item-1', name: 'Glossy Paper A4', quantity: 3, designId: 'design-1', unitPrice: 0 },
          { itemId: 'item-2', name: 'Stapler', quantity: 2, unitPrice: 0 },
        ],
      });

      const transaction = result.current.orderToHistoryTransaction(order);

      expect(transaction.id).toBe('order-7');
      expect(transaction.paymentMethod).toBe('Custom Order');
      expect(transaction.subtotal).toBe(500);
      expect(transaction.total).toBe(500);
      // A custom job carries no tax figure; it is priced as a job, not a sale.
      expect(transaction.tax).toBe(0);
      expect(transaction.vatRatePercent).toBe(0);
      expect(transaction.discount).toBeUndefined();
      expect(transaction.items).toMatchObject([
        { id: 'item-1', qty: 3, designId: 'design-1', isCustom: true, notes: 'Rush job' },
        { id: 'item-2', qty: 2, isCustom: true },
      ]);
    });

    it('falls back to the item name when a line carries no id', () => {
      const { result } = renderHistory([]);
      const order = makeOrder({ lineItems: [{ name: 'Stapler', quantity: 1, unitPrice: 0 }] });

      expect(result.current.orderToHistoryTransaction(order).items[0]?.id).toBe('item-2');
    });

    it('invents a priced line for a product the catalogue no longer carries', () => {
      const { result } = renderHistory([]);
      const order = makeOrder({
        amount: 400,
        quantity: 2,
        lineItems: [{ itemId: 'gone', name: 'Discontinued Ink', quantity: 2, unitPrice: 0 }],
      });

      const line = result.current.orderToHistoryTransaction(order).items[0];

      // Priced from the order's own average so the row still adds up.
      expect(line).toMatchObject({ id: 'gone', category: '—', stock: 0, price: 200, qty: 2 });
    });

    it('splits a legacy order across the items it names', () => {
      const { result } = renderHistory([]);
      const order = makeOrder({
        item: 'Glossy Paper A4, Stapler',
        quantity: 4,
        lineItems: undefined,
      });

      const transaction = result.current.orderToHistoryTransaction(order);

      expect(transaction.items.map((item) => [item.id, item.qty])).toEqual([
        ['item-1', 2],
        ['item-2', 2],
      ]);
    });

    it('gives a legacy line at least one, whatever the quantity says', () => {
      const { result } = renderHistory([]);
      const order = makeOrder({ item: 'Stapler', quantity: 0, lineItems: undefined });

      expect(result.current.orderToHistoryTransaction(order).items[0]?.qty).toBe(1);
    });
  });

  describe('the timeline', () => {
    it('mixes sales and orders, newest first', () => {
      const { result } = renderHistory(
        [makeTransaction({ id: 'TRX-old', date: '2026-09-01T10:00:00.000Z' })],
        [makeOrder({ id: 'order-new', date: '2026-09-21T10:00:00.000Z' })],
      );

      expect(result.current.rows.map((row) => row.source)).toEqual(['order', 'trx']);
    });

    it('is empty when there is nothing to show', () => {
      const { result } = renderHistory([], []);

      expect(result.current.rows).toEqual([]);
    });
  });

  describe('searching', () => {
    const orders = [makeOrder({ id: 'order-1', customer: 'Ada Lovelace', item: 'Tarpaulin' })];
    const transactions = [makeTransaction({ id: 'TRX-abc', items: [makeCartItem({ name: 'Stapler' })] })];

    it('shows everything when the box is blank', () => {
      const { result } = renderHistory(transactions, orders);

      expect(result.current.filteredRows).toHaveLength(2);
    });

    it('matches a sale by its reference', () => {
      const { result } = renderHistory(transactions, orders);

      act(() => result.current.setHistorySearchTerm('trx-AB'));

      expect(result.current.filteredRows.map((row) => row.trx?.id)).toEqual(['TRX-abc']);
    });

    it('matches a sale by an item it contains', () => {
      const { result } = renderHistory(transactions, orders);

      act(() => result.current.setHistorySearchTerm('stap'));

      expect(result.current.filteredRows.map((row) => row.trx?.id)).toEqual(['TRX-abc']);
    });

    it('matches an order by customer', () => {
      const { result } = renderHistory(transactions, orders);

      act(() => result.current.setHistorySearchTerm('lovelace'));

      expect(result.current.filteredRows.map((row) => row.order?.id)).toEqual(['order-1']);
    });

    it('matches an order by the item it names', () => {
      const { result } = renderHistory(transactions, orders);

      act(() => result.current.setHistorySearchTerm('tarpaulin'));

      expect(result.current.filteredRows.map((row) => row.order?.id)).toEqual(['order-1']);
    });

    it('ignores surrounding whitespace', () => {
      const { result } = renderHistory(transactions, orders);

      act(() => result.current.setHistorySearchTerm('  '));

      expect(result.current.filteredRows).toHaveLength(2);
    });

    it('finds nothing that is not there', () => {
      const { result } = renderHistory(transactions, orders);

      act(() => result.current.setHistorySearchTerm('heliograph'));

      expect(result.current.filteredRows).toEqual([]);
    });
  });

  it('selects and clears the row being inspected', () => {
    const { result } = renderHistory([makeTransaction()]);
    const transaction = makeTransaction({ id: 'TRX-9' });

    act(() => result.current.selectTransaction(transaction));
    expect(result.current.selectedTransaction?.id).toBe('TRX-9');

    act(() => result.current.selectTransaction(null));
    expect(result.current.selectedTransaction).toBeNull();
  });
});
