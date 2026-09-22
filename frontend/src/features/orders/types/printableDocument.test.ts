import { describe, expect, it } from 'vitest';

import {
  documentFromOrder,
  documentFromSale,
  documentFromTransaction,
  vatLabel,
} from './printableDocument';
import { makeCartItem, makeTotals } from '../../../test/fixtures';
import type { CartItem, Order, Transaction } from '../types';

/**
 * The mappers are where a document can lie about money.
 *
 * A retail receipt that prints "Balance Due" for a sale that was paid in full,
 * or a custom job that prints "Paid via Cash" for money nobody collected, are
 * both worse than a blank page — the customer reads them as a record. So these
 * tests are written around *what the paper asserts*, not around shapes.
 *
 * `now` is injected rather than mocked so the assertions are about behaviour and
 * not about the clock.
 */

const FIXED_DATE = new Date('2026-09-17T09:30:00.000Z');

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ORD-000123',
    customer: 'Acme Trading',
    item: 'Business Cards',
    lineItems: [],
    quantity: 500,
    status: 'Pending',
    date: '2026-09-15T02:00:00.000Z',
    updatedAt: '2026-09-15T02:00:00.000Z',
    amount: 5000,
    totalPaid: 0,
    balanceDue: 0,
    notes: '',
    isCustom: true,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'TRX-ABCD1234',
    date: '2026-09-16T04:00:00.000Z',
    items: [makeCartItem({ price: 100, qty: 2 })],
    subtotal: 200,
    discount: 0,
    vatRatePercent: 12,
    tax: 24,
    total: 224,
    paymentMethod: 'Cash',
    ...overrides,
  };
}

describe('a retail sale is a settled receipt', () => {
  it('is labelled as a receipt and states the payment was taken', () => {
    const document = documentFromSale({
      cart: [makeCartItem({ price: 100, qty: 2 })],
      totals: makeTotals(),
      paymentMethod: 'Card',
      now: FIXED_DATE,
    });

    expect(document.kind).toBe('receipt');
    expect(document.payment).toEqual({ method: 'Card', settled: true });
    // A counter sale has no balance — nothing is owed on a paid receipt.
    expect(document.balance).toBeUndefined();
  });

  it('prices each line from the cart, not from the cart total', () => {
    const cart: CartItem[] = [
      makeCartItem({ id: 'a', name: 'Glossy Paper', price: 25.5, qty: 4 }),
      makeCartItem({ id: 'b', name: 'Ink Cartridge', price: 900, qty: 1 }),
    ];
    const document = documentFromSale({
      cart,
      totals: makeTotals({ subtotal: 1002, tax: 120.24, total: 1122.24 }),
      paymentMethod: 'Cash',
      now: FIXED_DATE,
    });

    expect(document.lines.map((line) => line.unitPrice)).toEqual([25.5, 900]);
    expect(document.lines.map((line) => line.qty)).toEqual([4, 1]);
  });
});

describe('a custom job is never presented as paid', () => {
  it('becomes an order document when the sale carries an order id', () => {
    const document = documentFromSale({
      cart: [makeCartItem({ price: 5000, qty: 1 })],
      totals: makeTotals({ subtotal: 5000, tax: 600, total: 5600 }),
      // Even though the till's toggle said Cash, an order id means this is a job.
      paymentMethod: 'Cash',
      customerName: 'Acme Trading',
      orderId: 'ORD-000123',
      now: FIXED_DATE,
    });

    expect(document.kind).toBe('order');
    expect(document.payment.method).toBe('Custom Order');
    // The single most important assertion in this file: no money was collected
    // at the till, so the document must not claim any was.
    expect(document.payment.settled).toBe(false);
    expect(document.reference).toBe('ORD-000123');
    expect(document.customerName).toBe('Acme Trading');
  });
});

describe('a recorded sale is labelled by what it was, not by the current screen', () => {
  it('reprints a past cash sale as a settled receipt', () => {
    const document = documentFromTransaction(makeTransaction());

    expect(document.kind).toBe('receipt');
    expect(document.payment).toEqual({ method: 'Cash', settled: true });
    expect(document.reference).toBe('TRX-ABCD1234');
  });

  it('reprints a past custom order as an unpaid order summary', () => {
    const document = documentFromTransaction(
      makeTransaction({ id: 'ORD-000123', paymentMethod: 'Custom Order', tax: 0, vatRatePercent: 0 }),
    );

    // This is the bug the whole change exists to prevent: a historical custom
    // order reprinted while the terminal sits in Retail must still come out as
    // an order summary, because the *record* says so.
    expect(document.kind).toBe('order');
    expect(document.payment.method).toBe('Custom Order');
    expect(document.payment.settled).toBe(false);
  });

  it('derives the VAT rate when the record does not carry one', () => {
    const document = documentFromTransaction(
      makeTransaction({ subtotal: 200, discount: 0, tax: 24, vatRatePercent: undefined }),
    );

    expect(document.totals.taxLabel).toBe('VAT (12%)');
  });
});

describe('a job ticket carries the money still owed', () => {
  it('reports the balance from the order itself', () => {
    const document = documentFromOrder(makeOrder({ amount: 5000, totalPaid: 2000, balanceDue: 3000 }));

    expect(document.kind).toBe('order');
    expect(document.balance).toEqual({ totalPaid: 2000, balanceDue: 3000 });
    expect(document.payment.settled).toBe(false);
  });

  it('marks a fully paid job as settled', () => {
    const document = documentFromOrder(makeOrder({ amount: 5000, totalPaid: 5000, balanceDue: 0 }));

    expect(document.payment.settled).toBe(true);
    expect(document.balance?.balanceDue).toBe(0);
  });

  it('falls back to amount minus paid when the API omits a balance', () => {
    const document = documentFromOrder(makeOrder({ amount: 5000, totalPaid: 1500, balanceDue: undefined }));

    // Never `NaN`, and never silently zero — a ticket that understates what is
    // owed is how a shop hands over goods it was not paid for.
    expect(document.balance?.balanceDue).toBe(3500);
  });

  it('treats an order with no payments at all as fully outstanding', () => {
    const document = documentFromOrder(makeOrder({ amount: 5000, totalPaid: undefined, balanceDue: undefined }));

    expect(document.balance).toEqual({ totalPaid: 0, balanceDue: 5000 });
  });

  it('splits a multi-item job across its line items', () => {
    const document = documentFromOrder(
      makeOrder({
        item: 'Business Cards, Flyers',
        quantity: 600,
        amount: 6000,
        lineItems: [
          { name: 'Business Cards', quantity: 500, unitPrice: 4 },
          { name: 'Flyers', quantity: 100, unitPrice: 40 },
        ],
      }),
    );

    expect(document.lines.map((line) => line.name)).toEqual(['Business Cards', 'Flyers']);
    // A line price, when the order records one, is what prints — an average
    // across lines would misstate each one even though the total matched.
    expect(document.lines.map((line) => line.unitPrice)).toEqual([4, 40]);
  });

  it('spreads a single value across lines when the order has no line prices', () => {
    const document = documentFromOrder(
      makeOrder({ item: 'Business Cards, Flyers', quantity: 600, amount: 6000, lineItems: undefined }),
    );

    // 6000 / 600 units = 10 a unit, so each generated line balances the order.
    expect(document.lines).toHaveLength(2);
    expect(document.lines.every((line) => line.unitPrice === 10)).toBe(true);
    expect(document.lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0)).toBe(6000);
  });
});

describe('a stored zero price is not a free item', () => {
  it('falls back to the order average rather than printing ₱0.00', () => {
    // Real data does this: `order_items.unit_price` is non-null and older rows
    // hold 0. A `??` guard lets the zero through and the ticket shows a line
    // that appears free on an order worth ₱95.20.
    const document = documentFromOrder(
      makeOrder({
        amount: 95.2,
        quantity: 1,
        lineItems: [{ name: 'Acrylic Keychain', quantity: 1, unitPrice: 0 }],
      }),
    );

    expect(document.lines[0].unitPrice).toBe(95.2);
  });

  it('keeps a real price even when it differs from the average', () => {
    const document = documentFromOrder(
      makeOrder({
        amount: 1400,
        quantity: 100,
        lineItems: [
          { name: 'Cards', quantity: 50, unitPrice: 4 },
          { name: 'Flyers', quantity: 50, unitPrice: 24 },
        ],
      }),
    );

    expect(document.lines.map((line) => line.unitPrice)).toEqual([4, 24]);
    expect(document.lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0)).toBe(1400);
  });
});

describe('a reversed sale reprints as reversed', () => {
  it('marks a voided transaction', () => {
    const document = documentFromTransaction(makeTransaction({ status: 'voided' }));

    // The counter reprints a voided sale to prove which one was reversed. If the
    // paper does not say so, it reads as a live receipt.
    expect(document.voided).toBe(true);
  });

  it('leaves a completed sale unmarked', () => {
    expect(documentFromTransaction(makeTransaction({ status: 'completed' })).voided).toBe(false);
    expect(documentFromTransaction(makeTransaction({ status: undefined })).voided).toBe(false);
  });
});

describe('the tax line only appears when there is tax to show', () => {
  it('formats a whole rate without a trailing decimal', () => {
    expect(vatLabel(12)).toBe('VAT (12%)');
  });

  it('rounds a rate derived from stored amounts', () => {
    // 24 / 200 * 100 is 11.999999999999998 in floating point. Printing that on a
    // receipt would be absurd.
    expect(vatLabel(11.999999999999998)).toBe('VAT (12%)');
  });

  it('drops the line entirely at a zero rate', () => {
    expect(vatLabel(0)).toBe('');
    expect(vatLabel(Number.NaN)).toBe('');
  });
});
