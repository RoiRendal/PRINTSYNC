import { describe, expect, it } from 'vitest';
import { mapPaymentTransaction } from './usePOSTransactions';
import { makeInventoryItem } from '../../../test/fixtures';
import type { PaymentTransaction } from '../api/paymentsApi';

/**
 * Characterisation tests for the server-to-table mapping.
 *
 * This is the function that turns a recorded sale into what the history table
 * shows, and it is reused verbatim by the checkout's reconciliation path — so
 * if it is even slightly off, a sale and its reprint disagree. These pin the
 * shape: a known item keeps its catalogue record, an unknown one is rebuilt from
 * the server's own figures, a zero discount disappears, and the VAT rate is
 * derived back from the money.
 */

const PAPER = makeInventoryItem({ id: 'item-1', name: 'Glossy Paper A4', stock: 3, price: 100 });

function makeRaw(overrides: Partial<PaymentTransaction> = {}): PaymentTransaction {
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

describe('mapPaymentTransaction', () => {
  it('spreads a known catalogue item and takes its quantity from the line', () => {
    const result = mapPaymentTransaction(makeRaw(), [PAPER]);

    expect(result.items[0]).toMatchObject({ id: 'item-1', name: 'Glossy Paper A4', stock: 3, price: 100, qty: 2 });
  });

  it('rebuilds an item the catalogue no longer carries from the server figures', () => {
    const result = mapPaymentTransaction(
      makeRaw({ items: [{ itemId: 'gone', name: 'Discontinued Ink', quantity: 3, unitPrice: 50 }] }),
      [PAPER],
    );

    expect(result.items[0]).toMatchObject({
      id: 'gone',
      name: 'Discontinued Ink',
      stock: 0,
      price: 50,
      qty: 3,
    });
  });

  it('leaves the discount undefined rather than zero', () => {
    expect(mapPaymentTransaction(makeRaw({ discount: 0 }), [PAPER]).discount).toBeUndefined();
    expect(mapPaymentTransaction(makeRaw({ discount: 20 }), [PAPER]).discount).toBe(20);
  });

  it('derives the VAT rate back from the tax and net', () => {
    expect(mapPaymentTransaction(makeRaw({ subtotal: 200, discount: 0, tax: 24 }), [PAPER]).vatRatePercent).toBe(12);
  });

  it('shows no VAT when there is nothing to tax', () => {
    expect(mapPaymentTransaction(makeRaw({ subtotal: 100, discount: 100, tax: 0 }), [PAPER]).vatRatePercent).toBe(0);
  });

  it('carries the status so a voided sale reprints as voided', () => {
    expect(mapPaymentTransaction(makeRaw({ status: 'voided' }), [PAPER]).status).toBe('voided');
  });

  it('round-trips every top-level money field', () => {
    const result = mapPaymentTransaction(
      makeRaw({ subtotal: 500, discount: 50, tax: 54, total: 504, paymentMethod: 'Card' }),
      [PAPER],
    );

    expect(result).toMatchObject({
      id: 'TRX-1',
      subtotal: 500,
      discount: 50,
      tax: 54,
      total: 504,
      paymentMethod: 'Card',
    });
  });
});
