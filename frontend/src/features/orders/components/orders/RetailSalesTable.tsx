import { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Trash2 } from '../../../../shared/components/ui/icons';
import type { Transaction } from '../../types';
import {
  Badge, Button, Card, CardContent, CardHeader, Checkbox, DeleteConfirmModal, Modal,
  Pagination, SearchInput, StatusLabel, Table, TableBody, TableCell, TableContainer,
  TableHead, TableHeader, TableRow, TableSelectCell, TableSelectHead,
} from '../../../../shared/components/ui';
import { EmptyState } from '../../../../shared/components/feedback/EmptyState';
import { InlineAlert } from '../../../../shared/components/feedback/InlineAlert';
import { formatSelectedCount } from '../../../../shared/lib/selectionLabels';
import { useRowSelection } from '../../../../shared/hooks/useRowSelection';
import { DEFAULT_PAGE_SIZE } from '../../../../shared/store/createListStore';
import { useInventory } from '../../../../app/stores/useInventoryStore';
import { useOrders } from '../../../../app/stores/useOrderStore';
import { usePaymentStore } from '../../../../app/stores/usePaymentStore';
import { usePOSHistory } from '../../hooks/usePOSHistory';
import { usePOSTransactions } from '../../hooks/usePOSTransactions';
import { printDocument, usePOSReceipts } from '../../hooks/usePOSReceipts';
import { ReceiptModal } from '../pos/ReceiptModal';

const HISTORY_PAGE_SIZE = DEFAULT_PAGE_SIZE;

interface RetailSalesTableProps {
  /**
   * Opens the POS to ring up a new sale — the header's "+" control.
   *
   * Nothing else is asked of the page: Retail is the till's resting mode, so
   * this only has to navigate and the POS opens in Retail by itself.
   */
  onNewOrder: () => void;
}

/**
 * The retail-sales list, transplanted from the POS terminal.
 *
 * It used to be `POSHistoryView`, rendered as the second half of a
 * Terminal/History toggle on `/pos`. The toggle is the thing the Boss liked; the
 * POS was the wrong place for it. Sales are a RECORD, and a record belongs with
 * the other records on the Orders page — next to the custom orders it shares a
 * customer, a date and a till with — not behind a switch on the screen you ring
 * the next sale up on.
 *
 * Self-contained rather than props-driven, which is the one place it departs
 * from how `POSHistoryView` was written. That component took fourteen props from
 * the page, including the tick set and the page number, because the page also
 * needed them. Nothing else on `/orders` needs any of it, so hoisting the state
 * into `OrdersPage` would put a screenful of retail-sales plumbing into a file
 * about orders. `OrderSummaryCards` on the same page is self-contained for the
 * same reason.
 *
 * The invariant the old comment cared about is preserved and strengthened: the
 * rows and the tick set are still owned together — now by one component instead
 * of by a page that had to be trusted to keep them in step. `usePOSHistory` cuts
 * the rows to a page and `useRowSelection` is scoped to exactly those rows, so a
 * sale hidden by the search box or sitting on another page cannot be voided by
 * accident.
 */
export function RetailSalesTable({ onNewOrder }: RetailSalesTableProps) {
  const { items: inventory } = useInventory();
  const { orders } = useOrders();
  const { transactions, error: transactionError, voidTransaction } = usePOSTransactions({ inventory });
  /** Every piece of paper this list can reopen, frozen at the moment of sale. */
  const receipts = usePOSReceipts();

  const [historyPage, setHistoryPage] = useState(1);
  const history = usePOSHistory({
    transactions,
    orders,
    inventory,
    page: historyPage,
    pageSize: HISTORY_PAGE_SIZE,
  });

  const selection = useRowSelection(
    useMemo(
      () => history.selectableRows.map((row) => (row.source === 'trx' ? row.trx!.id : row.order!.id)),
      [history.selectableRows],
    ),
  );

  const [salesToVoid, setSalesToVoid] = useState<Transaction[]>([]);
  const [isVoiding, setIsVoiding] = useState(false);
  /** Which of a batch could not be reversed. Distinct from the store's own
   *  `transactionError`, which reports a load/void failure generically. */
  const [voidError, setVoidError] = useState<string | null>(null);

  // A new search term is a new result set, so go back to its first page. The
  // hook clamps anyway; this is what *returns* the user to page 1 rather than
  // leaving them on a page number that happens to still exist.
  useEffect(() => {
    setHistoryPage(1);
  }, [history.historySearchTerm]);

  /**
   * Captures the ticked sales and opens the confirmation.
   *
   * Snapshotted here rather than read back off `selection` on confirm: the list
   * can refresh underneath an open dialog, and the dialog has to name the sales
   * that were actually ticked, not whatever happens to be selected by then.
   */
  const openVoidConfirm = () => {
    const ids = selection.selectedIds;
    if (ids.size === 0) return;
    setSalesToVoid(transactions.filter((trx) => ids.has(trx.id)));
  };

  /**
   * Reverses every sale named in the confirmation, one at a time.
   *
   * `voidTransaction` is a single-row endpoint and adding a bulk route would be
   * a backend change this screen does not need. Void is not a delete — the sale
   * and the stock it moved stay on the record, marked reversed — which is why
   * the dialog's wording is changed and why a partial failure is reported by
   * reference rather than by customer.
   *
   * `voidTransaction` swallows its own error and reports through the store, so
   * the failure branch here cannot observe it. It re-reads the list instead: a
   * sale still `completed` after the attempt did not reverse, and naming it is
   * what lets the user retry the one that failed rather than all of them.
   */
  const confirmVoidSelected = async () => {
    if (salesToVoid.length === 0 || isVoiding) return;
    const targets = salesToVoid;
    setIsVoiding(true);
    try {
      for (const sale of targets) {
        await voidTransaction(sale.id);
      }
    } finally {
      // A throw before the close below would otherwise leave Confirm spinning on
      // a dialog that never goes away.
      setIsVoiding(false);
    }
    setSalesToVoid([]);
    selection.clear();

    const stillCompleted = new Set(
      usePaymentStore.getState().items.filter((item) => item.status === 'completed').map((item) => item.id),
    );
    const failed = targets.filter((sale) => stillCompleted.has(sale.id));
    if (failed.length > 0) {
      const names = failed.map((sale) => `#${sale.id.replace('TRX-', '').slice(-8)}`).join(', ');
      setVoidError(
        `${failed.length} of ${targets.length} sales could not be voided: ${names}. ${failed.length === 1 ? 'It is' : 'They are'} still completed — try again.`,
      );
      return;
    }
    setVoidError(null);
  };

  return (
    <>
      {transactionError && <InlineAlert message={transactionError} className="text-2xs" />}
      {voidError && <InlineAlert message={voidError} onDismiss={() => setVoidError(null)} className="text-2xs" />}

      <Card padding="none" className="overflow-hidden">
        <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-end">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:max-w-2xl">
            <SearchInput className="flex-1" aria-label="Filter transaction history" value={history.historySearchTerm} onChange={(e) => history.setHistorySearchTerm(e.target.value)} />
            {/*
              The table's only reversal control, and the same icon-only gray
              square the other list tables use. It is disabled until something is
              ticked; the hover title is the only place the user sees *why*, so
              the affordance is discoverable rather than appearing from nowhere
              on the first tick. Reversing undoes the sale and returns the stock,
              so the confirmation names each reference before it runs.
            */}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              disabled={selection.count === 0}
              onClick={openVoidConfirm}
              aria-label={selection.count > 0 ? `Void ${selection.count} selected sale${selection.count === 1 ? '' : 's'}` : 'Void selected sales'}
              title={selection.count === 0 ? 'Tick the sales you want to void first.' : `Void ${selection.count} sale${selection.count === 1 ? '' : 's'}`}
              className="shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            {/*
              The same "+" the other list tables carry, to the right of the void
              square. It asks the page only to navigate — Retail is already the
              till's resting mode, so there is no mode to set on the way over.
            */}
            <Button
              type="button"
              variant="primary"
              size="icon"
              onClick={onNewOrder}
              aria-label="New POS Order"
              title="New POS Order"
              className="shrink-0"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <TableContainer className="rounded-none border-0 bg-transparent">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableSelectHead>
                    <Checkbox
                      checked={selection.allSelected}
                      indeterminate={selection.isIndeterminate}
                      disabled={selection.count === 0 && !history.filteredRows.some((row) => row.status === 'completed')}
                      onChange={selection.toggleAll}
                      aria-label="Select all voidable sales on this page"
                    />
                  </TableSelectHead>
                  {/*
                    When rows are ticked the whole header collapses to just the
                    "# items selected" message (ERPNext item-list behaviour) — every
                    column label disappears. colSpan 5 = all five data columns, the
                    Action column having been folded into the header control.
                  */}
                  {selection.count === 0 ? (
                    <>
                      <TableHead>Ref ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </>
                  ) : (
                    <TableHead colSpan={5} className="font-semibold text-app-ink dark:text-zinc-100">
                      {formatSelectedCount(selection.count)}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.filteredRows.map((row) => {
                  const trx = row.source === 'trx' ? row.trx! : history.orderToHistoryTransaction(row.order!);
                  const key = row.source === 'trx' ? row.trx!.id : row.order!.id;
                  const refDisplay = row.source === 'trx' ? `#${row.trx!.id.replace('TRX-', '').slice(-8)}` : row.order!.id;
                  /*
                   * Only a completed sale is reversible. A custom order is not a
                   * sale, and an already-voided one is reversed — neither can be
                   * ticked, so "select all" never claims them and the count beside
                   * the button matches what the action will really take.
                   */
                  const isVoidable = row.source === 'trx' && row.status === 'completed';
                  return (
                    <TableRow key={key} className="cursor-pointer" onClick={() => history.selectTransaction(trx)}>
                      {/*
                        The tick has to stop here. The whole row opens the detail
                        modal, and without this a click on the box would open the
                        modal on top of the tick the user was aiming for.
                      */}
                      <TableSelectCell onClick={(event) => event.stopPropagation()}>
                        {isVoidable ? (
                          <Checkbox
                            checked={selection.has(key)}
                            onChange={() => selection.toggle(key)}
                            aria-label={`Select sale ${refDisplay}`}
                          />
                        ) : (
                          // No box at all rather than a disabled one: a grayed box
                          // reads as "you may not", which invites the user to work
                          // out why. The column stays even so the rows line up.
                          <span aria-hidden="true" className="block h-4 w-4" />
                        )}
                      </TableSelectCell>
                      <TableCell className="text-app-text-muted dark:text-zinc-500">{refDisplay}</TableCell>
                      <TableCell className="text-app-text-muted dark:text-zinc-400">{trx.date}</TableCell>
                      <TableCell>
                        <span className="tabular-nums text-app-ink dark:text-zinc-100">{trx.items.reduce((acc, curr) => acc + curr.qty, 0)} Units</span>
                      </TableCell>
                      <TableCell><StatusLabel tone="accent">{row.source === 'trx' ? row.trx!.paymentMethod : 'Order'}</StatusLabel></TableCell>
                      <TableCell className="text-right tabular-nums text-app-ink dark:text-zinc-100">₱{trx.total.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
                {history.filteredRows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="py-12">
                      <EmptyState title={history.historySearchTerm ? 'No entries match filters' : 'No retail sales yet'} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
        <div className="border-t px-4 py-3">
          <Pagination page={historyPage} limit={history.filteredRows.length} total={history.totalRows} onPageChange={setHistoryPage} />
        </div>
      </Card>

      <Modal isOpen={!!history.selectedTransaction} onClose={() => history.selectTransaction(null)} title="Transaction Details" maxWidth="max-w-sm">
        {history.selectedTransaction && (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 scrollbar-hide">
            <div className="flex items-start justify-between border-b pb-3">
              <div className="space-y-0.5">
                <p className="text-3xs font-bold text-app-text-muted">Reference ID</p>
                <p className="tabular-nums text-2xs font-bold">#{history.selectedTransaction.id}</p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-3xs font-bold text-app-text-muted">Date &amp; Time</p>
                <p className="text-2xs font-medium">{history.selectedTransaction.date}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-3xs font-bold text-app-text-muted">Items Purchased</p>
              <div className="max-h-36 space-y-1 overflow-y-auto pr-1 scrollbar-hide">
                {history.selectedTransaction.items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex items-center justify-between rounded-xl border p-2 text-2xs">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate font-bold text-app-ink dark:text-zinc-100">{item.name}</p>
                      <p className="text-3xs text-app-text-muted">{item.qty} × ₱{item.price.toFixed(2)}</p>
                    </div>
                    <p className="shrink-0 tabular-nums font-bold">₱{(item.price * item.qty).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 border-t pt-3 text-2xs text-app-text-muted">
              <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">₱{history.selectedTransaction.subtotal.toFixed(2)}</span></div>
              {(history.selectedTransaction.discount ?? 0) > 0 && <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">−₱{(history.selectedTransaction.discount ?? 0).toFixed(2)}</span></div>}
              <div className="flex justify-between"><span>VAT ({history.selectedTransaction.vatRatePercent ?? 12}%)</span><span className="tabular-nums">₱{history.selectedTransaction.tax.toFixed(2)}</span></div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="text-2xs font-bold text-app-ink dark:text-zinc-100">Total Amount</span>
                <span className="tabular-nums text-sm font-bold text-app-ink dark:text-zinc-100">₱{history.selectedTransaction.total.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--app-state-hover)] p-2 dark:bg-[var(--app-tint-gray)]">
                <span className="text-3xs font-bold text-app-ink dark:text-zinc-100">Payment</span>
                <Badge variant="accent">{history.selectedTransaction.paymentMethod}</Badge>
              </div>
            </div>

            <div className="flex gap-2">
              {/*
                The record is already saved, so reopening its paperwork is a
                read — nothing here re-creates the sale. Available for a voided
                transaction too: the customer is still holding the slip, and a
                reprint is how the counter proves which sale was reversed.
              */}
              <Button
                type="button"
                variant="secondary"
                fullWidth
                leftIcon={<Printer className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => {
                  receipts.openHistoricalReceipt(history.selectedTransaction!);
                  history.selectTransaction(null);
                }}
              >
                {history.selectedTransaction.paymentMethod === 'Custom Order' ? 'View Order Summary' : 'View Receipt'}
              </Button>
              <Button type="button" fullWidth onClick={() => history.selectTransaction(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      {/*
        Reversing a sale is not a delete: the record stays, marked voided, and
        the stock it consumed goes back on the shelf. The shared dialog says
        "This action cannot be undone", which is true of a void but reads at
        first glance like the row is about to be destroyed — and a cashier who
        believes that will not use the control when they should. The extra line
        says what actually happens, and the reference ids are named rather than
        the totals, because the id is what the slip in the customer's hand
        carries.
      */}
      <DeleteConfirmModal
        isOpen={salesToVoid.length > 0}
        itemLabels={salesToVoid.map((sale) => `#${sale.id.replace('TRX-', '').slice(-8)}`)}
        isBusy={isVoiding}
        onClose={() => setSalesToVoid([])}
        onConfirm={confirmVoidSelected}
      >
        <p className="text-sm text-app-ink dark:text-zinc-100">
          The sale is voided and the stock it used is returned to inventory. The record itself stays in the history, marked voided.
        </p>
      </DeleteConfirmModal>

      {/*
        Reads the frozen document, never live state — a historical record has no
        live state to read at all. `onPrint` renames the tab first so the saved
        PDF is called after the receipt rather than after the application. No
        `onNewOrder`: this list only ever reprints a sale that already happened,
        so "New Order" would describe an action the user did not ask for.
      */}
      <ReceiptModal
        isOpen={receipts.isReceiptModalOpen}
        onClose={receipts.closeReceiptModal}
        document={receipts.receipt}
        onPrint={() => receipts.receipt && printDocument(receipts.receipt)}
      />
    </>
  );
}
