import { useCallback, useEffect, useMemo } from 'react';
import { usePayments } from '../../../app/stores/usePaymentStore';
import type { InventoryItem } from '../../inventory/types';
import type { PaymentTransaction } from '../api/paymentsApi';
import type { Transaction } from '../types';

/**
 * Turns a raw server transaction into the shape the history table renders.
 *
 * Pure function of its inputs on purpose — it is tested on its own, and the
 * checkout flow reuses the *same* mapping both when a sale is first recorded and
 * when one is reconciled after a dropped response, so a sale and its reprint can
 * never disagree about what was sold.
 *
 * The only thing it cannot recover is an item the catalogue no longer carries;
 * rather than drop the line it synthesises one from the server's own figures, so
 * the row still adds up.
 */
export function mapPaymentTransaction(
  transaction: PaymentTransaction,
  inventory: InventoryItem[],
): Transaction {
  return {
    id: transaction.id,
    date: transaction.date,
    items: transaction.items.map((item) => {
      const inventoryItem = inventory.find((candidate) => candidate.id === item.itemId);
      return inventoryItem
        ? { ...inventoryItem, qty: item.quantity }
        : ({
            id: item.itemId ?? `transaction-${item.name}`,
            sku: item.itemId ?? `transaction-${item.name}`,
            name: item.name,
            category: '',
            stock: 0,
            reorderLevel: 0,
            price: item.unitPrice,
            // The catalogue row is gone, so there is no cost to recover; the
            // field is required by the contract and zero is the honest value.
            costPrice: 0,
            // `null`, not `undefined`: `imageUrl` is a nullable column, and a
            // key set to `undefined` would vanish from the JSON round-trip.
            imageUrl: null,
            createdAt: transaction.date,
            updatedAt: transaction.date,
            qty: item.quantity,
          } satisfies Transaction['items'][number]);
    }),
    subtotal: transaction.subtotal,
    discount: transaction.discount > 0 ? transaction.discount : undefined,
    vatRatePercent:
      transaction.subtotal > transaction.discount
        ? (transaction.tax / (transaction.subtotal - transaction.discount)) * 100
        : 0,
    tax: transaction.tax,
    total: transaction.total,
    paymentMethod: transaction.paymentMethod,
    status: transaction.status,
  };
}

export interface UsePOSTransactionsOptions {
  /** Used to put a price and a category back on a line the record only names. */
  inventory: InventoryItem[];
}

export interface POSTransactionsController {
  transactions: Transaction[];
  error: string | null;
  /** Reverses a recorded sale. Voiding restores the stock it consumed. */
  voidTransaction: (id: string) => Promise<void>;
  /** Shows a just-recorded sale immediately, before the next refetch. */
  recordCommitted: (transaction: PaymentTransaction) => void;
  /** Shows a reconciled sale immediately, before the next refetch. */
  recordReconciled: (transaction: PaymentTransaction) => void;
}

/**
 * The till's transaction history.
 *
 * Reads from `usePaymentStore` rather than calling `paymentsApi` directly — the
 * one place `POSPage` reached past the store layer (R11). Mapping happens here,
 * not in the store, because it needs the catalogue and the store must stay
 * endpoint-shaped. Sales are prepended optimistically so the history updates the
 * instant a till commits, and the central `payments` revalidator reconciles the
 * full list after its staleness window — which is why this hook no longer
 * subscribes to the bus itself.
 */
export function usePOSTransactions({ inventory }: UsePOSTransactionsOptions): POSTransactionsController {
  const { transactions: raw, error, ensureLoaded, voidTransaction, prependTransaction } = usePayments();

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const transactions = useMemo(
    () => raw.map((transaction) => mapPaymentTransaction(transaction, inventory)),
    [raw, inventory],
  );

  const recordCommitted = useCallback(
    (transaction: PaymentTransaction) => prependTransaction(transaction),
    [prependTransaction],
  );

  const recordReconciled = useCallback(
    (transaction: PaymentTransaction) => prependTransaction(transaction),
    [prependTransaction],
  );

  return { transactions, error, voidTransaction, recordCommitted, recordReconciled };
}
