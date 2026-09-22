import { useCallback, useState } from 'react';
import { documentFromTransaction, type PrintableDocument } from '../types/printableDocument';
import type { Transaction } from '../types';

/**
 * Prints one document and restores the tab title afterwards.
 *
 * Two jobs in one place. `@media print` in `index.css` decides *what* is on the
 * paper; this decides what the PDF is *called*. Without the rename, a cashier
 * printing three receipts in a row saves three files called "PrintSync" and has
 * to open each to find the right one.
 */
export function printDocument(document: PrintableDocument) {
  const previousTitle = window.document.title;
  const safeRef = document.reference.replace(/[^a-zA-Z0-9-]/g, '');
  window.document.title = `${document.kind === 'receipt' ? 'Receipt' : 'Order'}-${safeRef}`;
  try {
    window.print();
  } finally {
    // Restored synchronously: `window.print()` blocks until the dialog closes in
    // every browser we support, so the title is correct for the print job and
    // back to normal before the user sees the tab again.
    window.document.title = previousTitle;
  }
}

/**
 * The sale just completed, so its paperwork can be reopened.
 *
 * The receipt used to exist only inside the checkout dialog, which closes itself
 * two seconds after a sale. A customer who wants their summary an hour later, or
 * a cashier whose printer jammed, had no way to get it back — the document was
 * gone. This is what makes it survive.
 */
export interface LastDocument {
  document: PrintableDocument;
  /** Shown on the terminal button so the cashier knows which sale it reopens. */
  label: string;
}

export interface POSReceipts {
  /** The document on screen in the receipt dialog, or `null` when it is closed. */
  receipt: PrintableDocument | null;
  isReceiptModalOpen: boolean;
  lastDocument: LastDocument | null;
  /** Stages a completed sale's paperwork for printing. */
  recordCompletedSale: (document: PrintableDocument, customerName?: string) => void;
  /** Reopens the paperwork for a row in the history table. */
  openHistoricalReceipt: (transaction: Transaction) => void;
  reopenLastDocument: () => void;
  openReceiptModal: () => void;
  closeReceiptModal: () => void;
}

/**
 * Owns every piece of paper the till can produce.
 *
 * One rule runs through all of it: **a document is frozen when it is created**.
 * The live cart is cleared the instant a sale completes, so anything rendered
 * from live state prints an empty slip — which is exactly what this used to do.
 * `recordCompletedSale` therefore takes the document, never the cart.
 */
export function usePOSReceipts(): POSReceipts {
  const [receipt, setReceipt] = useState<PrintableDocument | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [lastDocument, setLastDocument] = useState<LastDocument | null>(null);

  /**
   * Files a completed sale's paperwork.
   *
   * One call does three things that must never drift apart: stage the document
   * for the receipt dialog, keep a copy on the terminal so it can be reopened
   * after the dialog closes, and derive the button's label from the same
   * document. The label is the last eight characters of the reference, matching
   * how the history table abbreviates a sale — so the button and the row a
   * cashier finds later read as the same thing.
   */
  const recordCompletedSale = useCallback((document: PrintableDocument, customerName?: string) => {
    const shortRef = document.reference.replace('TRX-', '').slice(-8);
    setReceipt(document);
    setLastDocument({
      document,
      label:
        document.kind === 'receipt'
          ? `#${shortRef}`
          : `${customerName || 'Order'} · ${document.reference}`,
    });
  }, []);

  /**
   * Reopens the paperwork for a row in the history table.
   *
   * Takes the `Transaction` the table already holds and maps it, rather than
   * hunting for the matching row object: by the time a cashier clicks, the table
   * has already normalised sales and custom orders into one shape, and going
   * back to the raw order would be a second, lossier conversion of data that is
   * sitting right there.
   *
   * The document is derived from the *record*, so a past custom order reprints
   * as an order summary even while the terminal is set to Retail.
   */
  const openHistoricalReceipt = useCallback((transaction: Transaction) => {
    setReceipt(documentFromTransaction(transaction));
    setIsReceiptModalOpen(true);
  }, []);

  const reopenLastDocument = useCallback(() => {
    if (!lastDocument) return;
    setReceipt(lastDocument.document);
    setIsReceiptModalOpen(true);
  }, [lastDocument]);

  const openReceiptModal = useCallback(() => setIsReceiptModalOpen(true), []);
  const closeReceiptModal = useCallback(() => setIsReceiptModalOpen(false), []);

  return {
    receipt,
    isReceiptModalOpen,
    lastDocument,
    recordCompletedSale,
    openHistoricalReceipt,
    reopenLastDocument,
    openReceiptModal,
    closeReceiptModal,
  };
}
