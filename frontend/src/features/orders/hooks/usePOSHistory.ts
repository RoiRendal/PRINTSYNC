import { useCallback, useMemo, useState } from 'react';
import type { TransactionStatus } from '@printsync/shared-types';
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
  /**
   * The record's own state, carried up from the cursor.
   *
   * Deliberately read here rather than re-derived by the table: a custom order
   * has no status at all (it has not been voided or completed — it is a
   * production job), and a sale that has been voided must never be selectable
   * again, because `void_transaction` refuses anything not still `completed`
   * and would fail the row.
   */
  status: TransactionStatus | null;
}

export interface UsePOSHistoryOptions {
  /** Recorded counter sales. */
  transactions: Transaction[];
  /** Custom orders, shown alongside them. */
  orders: Order[];
  /** Used to put a price and a category back on a line the record only names. */
  inventory: InventoryItem[];
  /** Which browser page of the combined list is on screen. 1-based. */
  page: number;
  /** Rows per browser page. Also decides where the list is cut off. */
  pageSize: number;
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
  /**
   * `rows` narrowed by the search box, and then cut down to whole pages.
   *
   * Paged here rather than in the component because the tick set has to be
   * scoped to what is actually on screen. The store hands back a server page
   * (`limit`, default 20) and this list is paged again in the browser, so the
   * tail of the store's page is reachable by a page whose rows are not
   * rendered — selecting it and then deleting would act on rows the user was
   * never shown. Trimming the overhang here makes the last page exact, so
   * "select all" can only ever mean the rows on the page in front of you.
   */
  filteredRows: CombinedHistoryRow[];
  /**
   * The subset of `filteredRows` a bulk action may legitimately act on.
   *
   * This is what feeds `useRowSelection`, not `filteredRows`: a call to action
   * cannot be offered on a row it would refuse, and the void RPC rejects
   * anything no longer `completed`. Excluding those rows here means "select
   * all" never claims them and the count beside the button always matches the
   * number of rows the action will really take.
   */
  selectableRows: CombinedHistoryRow[];
  totalRows: number;
  totalPages: number;
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
  page,
  pageSize,
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
      // A custom order carries no `status` — the field describes a sale, and an
      // order is a production job — so it is `null` rather than guessed at.
      ...transactions.map((trx) => ({ source: 'trx' as const, trx, status: trx.status ?? null })),
      ...orders.map((order) => ({ source: 'order' as const, order, status: null })),
    ];
    combined.sort((a, b) => {
      const da = a.source === 'trx' ? a.trx!.date : a.order!.date;
      const db = b.source === 'trx' ? b.trx!.date : b.order!.date;
      return db.localeCompare(da);
    });
    return combined;
  }, [transactions, orders]);

  const matchedRows = useMemo(() => {
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

  /*
   * The page is clamped here rather than trusted from the caller. A search that
   * shortens the list, or a void that removes the last row on the final page,
   * can leave the caller asking for a page that no longer exists — and a caller
   * free to hold a stale page is free to hand the tick set rows that are not on
   * screen. Clamping in one place means the component renders exactly what this
   * says is on the page, and never has to defend itself.
   */
  const totalRows = matchedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const filteredRows = useMemo(
    () => matchedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [matchedRows, currentPage, pageSize],
  );

  /**
   * Only a completed sale can be reversed.
   *
   * A voided sale is already reversed and the RPC refuses it; a custom order is
   * not a sale at all, so there is nothing for a payment reversal to do to it.
   */
  const selectableRows = useMemo(
    () => filteredRows.filter((row) => row.source === 'trx' && row.status === 'completed'),
    [filteredRows],
  );

  return {
    historySearchTerm,
    setHistorySearchTerm,
    selectedTransaction,
    selectTransaction,
    orderToHistoryTransaction,
    rows,
    filteredRows,
    selectableRows,
    totalRows,
    totalPages,
  };
}
