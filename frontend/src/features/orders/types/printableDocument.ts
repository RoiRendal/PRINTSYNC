import type { CartTotals } from '../hooks/useCartTotals';
import type { CartItem, Order, OrderLineItem, Transaction } from '../types';

/**
 * Which paper a document is printed on.
 *
 * `receipt` is a counter sale that was paid at the till — a tax receipt.
 * `order` is a custom job entered into the production pipeline, which is an
 * acknowledgement rather than proof of payment, and carries a balance.
 *
 * These are two different documents, not two skins on one. Naming the
 * distinction here is what stops a custom job printing "Paid via Cash".
 */
export type PrintableDocumentKind = 'receipt' | 'order';

/** How the money was taken. `Custom Order` means "not collected at the till". */
export type PrintablePaymentMethod = 'Cash' | 'Card' | 'Custom Order';

export interface PrintableDocumentLine {
  /** Stable key for React, and the design reference when one is attached. */
  id: string;
  name: string;
  qty: number;
  /** Price for a *single* unit. Line total is `unitPrice * qty`. */
  unitPrice: number;
  /** Set when the line carries artwork or a custom job ticket. */
  designId?: string;
  sku?: string;
}

export interface PrintableDocumentTotals {
  subtotal: number;
  discount: number;
  tax: number;
  /** Label for the tax line, e.g. `VAT (12%)`. */
  taxLabel: string;
  total: number;
}

/**
 * Everything a printable document needs, frozen.
 *
 * Values in, JSX out. The renderer takes this and nothing else — no stores, no
 * live page state. That is the whole point: a document built from a *record*
 * (a past sale or an order pulled from the server) must print the same as one
 * built at the moment of sale, and it must not be able to pick up the current
 * screen's mode and mislabel itself.
 */
export interface PrintableDocument {
  kind: PrintableDocumentKind;
  /** Business-facing reference: `TRX-…` for a sale, the order id otherwise. */
  reference: string;
  /** Pre-formatted for display; the caller decides the format. */
  date: string;
  lines: PrintableDocumentLine[];
  totals: PrintableDocumentTotals;
  payment: {
    method: PrintablePaymentMethod;
    /** `true` when the document shows money actually collected. */
    settled: boolean;
  };
  /** Walk-in when absent. */
  customerName?: string;
  /** Order documents only: production notes for the shop floor. */
  notes?: string;
  /** Order documents only. `undefined` for a retail receipt. */
  balance?: {
    totalPaid: number;
    balanceDue: number;
  };
  /**
   * Set when the sale behind this document was reversed.
   *
   * A voided sale is still reprintable — the counter needs the paper to prove
   * which sale was reversed — but it must never come out of the printer looking
   * like a live one. The renderer stamps it; the amounts are left as recorded
   * rather than zeroed, because altering a reprint of a record would be worse
   * than marking it.
   */
  voided?: boolean;
}

/**
 * The tax line's label, from a rate.
 *
 * Rates arrive as floats derived from stored amounts (`tax / net * 100`), so
 * they are rounded for display and a zero rate drops the line entirely rather
 * than printing "VAT (0%)".
 */
export function vatLabel(vatRatePercent: number): string {
  if (!Number.isFinite(vatRatePercent) || vatRatePercent <= 0) return '';
  const rounded = Math.round(vatRatePercent * 100) / 100;
  return `VAT (${rounded}%)`;
}

/** A receipt for a sale that is happening right now, from the POS cart. */
export function documentFromSale(input: {
  cart: CartItem[];
  totals: CartTotals;
  paymentMethod: 'Cash' | 'Card';
  customerName?: string;
  orderId?: string;
  /** Injectable clock so tests are not time-dependent. */
  now?: Date;
}): PrintableDocument {
  const { cart, totals, paymentMethod, customerName, orderId } = input;
  const now = input.now ?? new Date();
  const isOrder = Boolean(orderId);
  const totalUnits = cart.reduce((sum, item) => sum + item.qty, 0) || 1;

  return {
    kind: isOrder ? 'order' : 'receipt',
    reference: orderId ?? `SALE-${now.getTime()}`,
    date: now.toLocaleString(),
    lines: cart.map((item, index) => ({
      id: `${item.id}-${index}`,
      name: item.name,
      qty: item.qty,
      // Same `> 0` guard as an order line: an unpriced cart entry would
      // otherwise print as free rather than falling back to the basket average.
      unitPrice: item.price > 0 ? item.price : totals.subtotal / totalUnits,
      designId: item.designId,
      sku: item.sku,
    })),
    totals: {
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      taxLabel: vatLabel(totals.vatRatePercent),
      total: totals.total,
    },
    payment: {
      // A custom job is created, not paid for. Saying "Cash" would assert money
      // that was never collected.
      method: isOrder ? 'Custom Order' : paymentMethod,
      settled: !isOrder,
    },
    customerName,
    notes: undefined,
    balance: undefined,
  };
}

/**
 * A receipt for a sale already recorded, as the history table holds it.
 *
 * Historically-shaped input, including the custom-order rows the POS table
 * synthesises from orders — which is why `paymentMethod === 'Custom Order'` is
 * what decides the document here. A past sale must be labelled by what it
 * *was*, never by what the terminal happens to be set to now.
 */
export function documentFromTransaction(transaction: Transaction): PrintableDocument {
  const vatRatePercent =
    transaction.vatRatePercent ??
    (transaction.subtotal - (transaction.discount ?? 0) > 0
      ? (transaction.tax / (transaction.subtotal - (transaction.discount ?? 0))) * 100
      : 0);

  const totalUnits = transaction.items.reduce((sum, item) => sum + item.qty, 0) || 1;
  const averageUnitPrice = transaction.subtotal / totalUnits;

  return {
    kind: transaction.paymentMethod === 'Custom Order' ? 'order' : 'receipt',
    reference: transaction.id,
    date: transaction.date,
    lines: transaction.items.map((item, index) => ({
      id: `${item.id}-${index}`,
      name: item.name,
      qty: item.qty,
      // A stored zero price is not a free item — see the note in
      // `documentFromOrder`. `sales_transaction_items.unit_price` is never zero
      // today, but the guard costs nothing and the failure is silent.
      unitPrice: item.price > 0 ? item.price : averageUnitPrice,
      designId: item.designId,
      sku: item.sku,
    })),
    totals: {
      subtotal: transaction.subtotal,
      discount: transaction.discount ?? 0,
      tax: transaction.tax,
      taxLabel: vatLabel(vatRatePercent),
      total: transaction.total,
    },
    payment: {
      method: transaction.paymentMethod,
      settled: transaction.paymentMethod !== 'Custom Order',
    },
    customerName: undefined,
    notes: undefined,
    balance: undefined,
    voided: transaction.status === 'voided',
  };
}

/**
 * A job ticket for a custom order.
 *
 * Unlike a receipt this carries the money *still owed*, not just the value of
 * the job — the shop floor needs to know before it hands anything over. The
 * values are the order's own (`totalPaid` / `balanceDue` as the API reports
 * them); nothing is inferred, so a ticket can never disagree with the order.
 */
export function documentFromOrder(
  order: Order,
  options: { date?: string } = {},
): PrintableDocument {
  /*
   * Annotated as `OrderLineItem[]`, not left to inference: the two branches
   * below produce different shapes (the fallback has no `itemId` or
   * `unitPrice`), and the union that inference would build cannot be read
   * without narrowing every field at the point of use.
   */
  const lineItems: OrderLineItem[] =
    order.lineItems && order.lineItems.length > 0
      ? order.lineItems
      : order.item
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({
            name,
            quantity: Math.max(1, Math.floor(order.quantity / Math.max(1, order.item.split(',').map((s) => s.trim()).filter(Boolean).length))),
            designId: order.designId,
          }));

  const totalPaid = order.totalPaid ?? 0;
  const balanceDue = order.balanceDue ?? Math.max(0, order.amount - totalPaid);
  const averageUnitPrice = order.amount / Math.max(1, order.quantity);

  return {
    kind: 'order',
    reference: order.id,
    date: options.date ?? order.date,
    lines: lineItems.map((lineItem, index) => ({
      id: `${lineItem.itemId ?? lineItem.name}-${index}`,
      name: lineItem.name,
      qty: lineItem.quantity,
      /*
       * A line's own price when the order records a usable one, else the
       * order's average.
       *
       * The test is `> 0`, not `??`. `order_items.unit_price` is a non-null
       * column that older rows store as `0`, so `??` would let a stored zero
       * through and print "₱0.00" against a line on a ticket worth ₱95 — a
       * line that looks free. The average is the honest fallback here because
       * the order's own amount is what the customer was quoted; it keeps the
       * printed lines adding up to that amount.
       */
      unitPrice: (lineItem.unitPrice ?? 0) > 0 ? lineItem.unitPrice! : averageUnitPrice,
      designId: lineItem.designId ?? order.designId,
    })),
    totals: {
      subtotal: order.amount,
      discount: 0,
      tax: 0,
      taxLabel: '',
      total: order.amount,
    },
    payment: { method: 'Custom Order', settled: balanceDue <= 0 },
    customerName: order.customer,
    notes: order.notes,
    balance: { totalPaid, balanceDue },
  };
}
