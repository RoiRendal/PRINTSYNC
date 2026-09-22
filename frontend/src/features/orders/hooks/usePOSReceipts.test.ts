import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { printDocument, usePOSReceipts } from './usePOSReceipts';
import { documentFromTransaction, type PrintableDocument } from '../types/printableDocument';
import type { Transaction } from '../types';
import { makeCartItem } from '../../../test/fixtures';

/**
 * Characterisation tests for the till's paperwork.
 *
 * These pin behaviour that `POSPage` already had before the move: the shape of
 * the "last receipt" label, the fact that a reopened document is the *frozen*
 * one rather than anything live, and the tab rename that decides what a printed
 * PDF is called. Nothing here is new behaviour — if one of these fails after the
 * extraction, the extraction moved something.
 */

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'TRX-20260921-000123',
    date: '2026-09-21T10:00:00.000Z',
    items: [makeCartItem()],
    subtotal: 200,
    tax: 24,
    total: 224,
    paymentMethod: 'Cash',
    ...overrides,
  };
}

function makeDocument(overrides: Partial<PrintableDocument> = {}): PrintableDocument {
  return {
    kind: 'receipt',
    reference: 'TRX-20260921-000123',
    date: '2026-09-21 10:00',
    lines: [{ id: 'item-1-0', name: 'Glossy Paper A4', qty: 2, unitPrice: 100 }],
    totals: { subtotal: 200, discount: 0, tax: 24, taxLabel: 'VAT (12%)', total: 224 },
    payment: { method: 'Cash', settled: true },
    ...overrides,
  };
}

describe('usePOSReceipts', () => {
  it('starts with nothing on screen and no dialog', () => {
    const { result } = renderHook(() => usePOSReceipts());

    expect(result.current.receipt).toBeNull();
    expect(result.current.isReceiptModalOpen).toBe(false);
    expect(result.current.lastDocument).toBeNull();
  });

  describe('recordCompletedSale', () => {
    it('stages the document and remembers it as the last sale', () => {
      const { result } = renderHook(() => usePOSReceipts());
      const document = makeDocument();

      act(() => result.current.recordCompletedSale(document));

      expect(result.current.receipt).toBe(document);
      expect(result.current.lastDocument?.document).toBe(document);
    });

    it('labels a receipt with the last eight characters of the reference', () => {
      const { result } = renderHook(() => usePOSReceipts());

      act(() => result.current.recordCompletedSale(makeDocument({ reference: 'TRX-20260921-000123' })));

      // `TRX-` is stripped first, then the last eight characters are taken — so
      // the label matches how the history table abbreviates the same sale.
      expect(result.current.lastDocument?.label).toBe('#1-000123');
    });

    it('labels an order with the customer and the full reference', () => {
      const { result } = renderHook(() => usePOSReceipts());

      act(() =>
        result.current.recordCompletedSale(
          makeDocument({ kind: 'order', reference: 'a1b2c3d4-order' }),
          'Ada Lovelace',
        ),
      );

      expect(result.current.lastDocument?.label).toBe('Ada Lovelace · a1b2c3d4-order');
    });

    it('falls back to "Order" when a custom job has no customer name', () => {
      const { result } = renderHook(() => usePOSReceipts());

      act(() =>
        result.current.recordCompletedSale(makeDocument({ kind: 'order', reference: 'a1b2c3d4-order' })),
      );

      expect(result.current.lastDocument?.label).toBe('Order · a1b2c3d4-order');
    });

    it('does not open the dialog on its own — the sale panel drives that', () => {
      const { result } = renderHook(() => usePOSReceipts());

      act(() => result.current.recordCompletedSale(makeDocument()));

      expect(result.current.isReceiptModalOpen).toBe(false);
    });
  });

  describe('reopening', () => {
    it('reopens the frozen document of the last sale', () => {
      const { result } = renderHook(() => usePOSReceipts());
      const document = makeDocument();

      act(() => result.current.recordCompletedSale(document));
      act(() => result.current.reopenLastDocument());

      expect(result.current.receipt).toBe(document);
      expect(result.current.isReceiptModalOpen).toBe(true);
    });

    it('does nothing when there is no last sale', () => {
      const { result } = renderHook(() => usePOSReceipts());

      act(() => result.current.reopenLastDocument());

      expect(result.current.receipt).toBeNull();
      expect(result.current.isReceiptModalOpen).toBe(false);
    });

    it('derives a historical document from the record, not from the current mode', () => {
      const { result } = renderHook(() => usePOSReceipts());
      // A past custom order must reprint as an order summary even while the
      // terminal is set to Retail.
      const transaction = makeTransaction({ paymentMethod: 'Custom Order' });

      act(() => result.current.openHistoricalReceipt(transaction));

      expect(result.current.receipt).toEqual(documentFromTransaction(transaction));
      expect(result.current.receipt?.kind).toBe('order');
      expect(result.current.isReceiptModalOpen).toBe(true);
    });

    it('marks a voided sale as voided on the reprint', () => {
      const { result } = renderHook(() => usePOSReceipts());

      act(() => result.current.openHistoricalReceipt(makeTransaction({ status: 'voided' })));

      expect(result.current.receipt?.voided).toBe(true);
    });

    it('closes the dialog without discarding the document', () => {
      const { result } = renderHook(() => usePOSReceipts());
      const document = makeDocument();

      act(() => result.current.recordCompletedSale(document));
      act(() => result.current.openReceiptModal());
      act(() => result.current.closeReceiptModal());

      expect(result.current.isReceiptModalOpen).toBe(false);
      expect(result.current.receipt).toBe(document);
    });
  });
});

describe('printDocument', () => {
  /**
   * jsdom has no print dialog and `vi.stubGlobal` lands on `globalThis`, while
   * the code under test calls `window.print()` explicitly — so `window.print` is
   * replaced directly. It is put back afterwards because `window` is shared by
   * every test in the file.
   */
  function stubPrint(implementation?: () => void): () => void {
    const original = window.print;
    const print = vi.fn(implementation);
    Object.defineProperty(window, 'print', { value: print, configurable: true, writable: true });
    return () => {
      Object.defineProperty(window, 'print', { value: original, configurable: true, writable: true });
      return print;
    };
  }

  it('opens the print dialog and restores the tab title', () => {
    const restore = stubPrint();

    window.document.title = 'PrintSync';
    printDocument(makeDocument({ kind: 'receipt', reference: 'TRX-20260921-000123' }));

    expect(restore()).toHaveBeenCalledOnce();
    expect(window.document.title).toBe('PrintSync');
  });

  it('names the print job after the document', () => {
    const seen: string[] = [];
    const restore = stubPrint(() => {
      // Captured while the dialog is "open", which is the only moment the title
      // differs from the restored one.
      seen.push(window.document.title);
    });

    window.document.title = 'PrintSync';
    printDocument(makeDocument({ kind: 'order', reference: 'ORD 1/2' }));

    expect(seen).toEqual(['Order-ORD12']);
    expect(window.document.title).toBe('PrintSync');
    restore();
  });

  it('restores the title even if printing throws', () => {
    const restore = stubPrint(() => {
      throw new Error('printer jam');
    });

    window.document.title = 'PrintSync';

    expect(() => printDocument(makeDocument())).toThrow('printer jam');
    expect(window.document.title).toBe('PrintSync');
    restore();
  });
});
