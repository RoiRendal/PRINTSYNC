import { useCallback, useMemo, useState } from 'react';
import type { InventoryItem } from '../../inventory/types';
import type { CartItem, Order, Transaction } from '../types';

/**
 * One row of the history table.
 *
 * Sales and custom orders are different records behind the scenes — one is a
 * payment row, the other a production job — but the till shows them in a single
 * timeline, so both are carried here and tagged with where they came from.
 */
export interface CombinedHistoryRow {
  source: 'trx' | 'order';
  trx?: Transaction;
  order?: Order;
}

export interface UsePOSHistoryOptions {
  /** Recorded counter sales. */
  transactions: Transaction[];
  /** Custom orders, shown alongside them. */
  orders: Order[];
  /** Used to put a price and a category back on a line the record only names. */
  inventory: InventoryItem[];
}

export interface POSHistoryController {
  historySearchTerm: string;
  setHistorySearchTerm: (term: string) => void;
  selectedTransaction: Transaction | null;
  selectTransaction: (transaction: Transaction | null) => void;
  /** Normalises a custom order into the same shape as a recorded sale. */
  orderToHistoryTransaction: (order: Order) => Transaction;
  /** Sales and orders together, newest first. */
  rows: CombinedHistoryRow[];
  /** `rows` narrowed by the search box. */
  filteredRows: CombinedHistoryRow[];
}

/**
 * Builds the till's history timeline.
 *
 * The conversion it performs is deliberately lossy in one direction only: a
 * custom order is flattened into the shape of a sale so the table can sort and
 * search both at once. Nothing is ever converted the other way — a row the
 * cashier clicks is reopened from the `Transaction` the table already holds, not
 * from the order behind it, which would be a second and worse conversion of
 * data sitting right there.
 */
export function usePOSHistory({
  transactions,
  orders,
  inventory,
}: UsePOSHistoryOptions): POSHistoryController {
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const selectTransaction = useCallback(
    (transaction: Transaction | null) => setSelectedTransaction(transaction),
    [],
  );

  const orderToHistoryTransaction = useCallback(
    (order: Order): Transaction => {
      const items: CartItem[] =
        order.lineItems && order.lineItems.length > 0
          ? order.lineItems.map((li) => {
              const inv =
                (li.itemId ? inventory.find((i) => i.id === li.itemId) : undefined) ??
                inventory.find((i) => i.name === li.name);
              const base: InventoryItem =
                inv ??
                ({
                  id: li.itemId ?? 'unknown',
                  sku: 'unknown',
                  name: li.name,
                  category: '—',
                  stock: 0,
                  reorderLevel: 0,
                  price: order.amount / Math.max(1, order.quantity),
                  createdAt: order.date,
                  updatedAt: order.date,
                } as InventoryItem);
              return {
                ...base,
                qty: li.quantity,
                designId: li.designId,
                isCustom: true,
                notes: order.notes,
              };
            })
          : order.item
              .split(',')
              .map((name) => name.trim())
              .filter(Boolean)
              .map((name) => {
                const inv = inventory.find((i) => i.name === name);
                const base: InventoryItem =
                  inv ??
                  ({
                    id: 'unknown',
                    sku: 'unknown',
                    name,
                    category: '—',
                    stock: 0,
                    reorderLevel: 0,
                    price: order.amount / Math.max(1, order.quantity),
                    createdAt: order.date,
                    updatedAt: order.date,
                  } as InventoryItem);
                const n = Math.max(
                  1,
                  order.item.split(',').map((s) => s.trim()).filter(Boolean).length,
                );
                return {
                  ...base,
                  qty: Math.max(1, Math.floor(order.quantity / n)),
                  isCustom: order.isCustom,
                };
              });

      return {
        id: order.id,
        date: order.date,
        items,
        subtotal: order.amount,
        discount: undefined,
        vatRatePercent: 0,
        tax: 0,
        total: order.amount,
        paymentMethod: 'Custom Order',
      };
    },
    [inventory],
  );

  const rows = useMemo((): CombinedHistoryRow[] => {
    const combined: CombinedHistoryRow[] = [
      ...transactions.map((trx) => ({ source: 'trx' as const, trx })),
      ...orders.map((order) => ({ source: 'order' as const, order })),
    ];
    combined.sort((a, b) => {
      const da = a.source === 'trx' ? a.trx!.date : a.order!.date;
      const db = b.source === 'trx' ? b.trx!.date : b.order!.date;
      return db.localeCompare(da);
    });
    return combined;
  }, [transactions, orders]);

  const filteredRows = useMemo(() => {
    const q = historySearchTerm.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((row) => {
      if (row.source === 'trx') {
        const t = row.trx!;
        return (
          t.id.toLowerCase().includes(q) || t.items.some((i) => i.name.toLowerCase().includes(q))
        );
      }
      const o = row.order!;
      return (
        o.id.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.item.toLowerCase().includes(q)
      );
    });
  }, [rows, historySearchTerm]);

  return {
    historySearchTerm,
    setHistorySearchTerm,
    selectedTransaction,
    selectTransaction,
    orderToHistoryTransaction,
    rows,
    filteredRows,
  };
}
