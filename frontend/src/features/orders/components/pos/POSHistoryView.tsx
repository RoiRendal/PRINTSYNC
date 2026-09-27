import { Printer, Search, Trash2 } from '../../../../shared/components/ui/icons';
import type { Transaction, Order } from '../../types';
import { Badge, Button, Card, CardContent, CardHeader, Checkbox, Input, Modal, Pagination, StatusLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, TableSelectCell, TableSelectHead } from '../../../../shared/components/ui';
import { EmptyState } from '../../../../shared/components/feedback/EmptyState';
import { formatSelectedCount } from '../../../../shared/lib/selectionLabels';
import type { RowSelection } from '../../../../shared/hooks/useRowSelection';
import type { CombinedHistoryRow } from '../../hooks/usePOSHistory';

interface POSHistoryViewProps {
  /** The rows for the current page, already cut to whole pages by the hook. */
  filteredHistoryRows: CombinedHistoryRow[];
  totalRows: number;
  /** Which page of the combined list is on screen. Owned by the page. */
  historyPage: number;
  onHistoryPageChange: (page: number) => void;
  historySearchTerm: string;
  selectedTransaction: Transaction | null;
  onHistorySearchChange: (value: string) => void;
  onSelectTransaction: (transaction: Transaction) => void;
  /**
   * Reverses every ticked sale. The row's own trash button was removed, so this
   * is the table's only reversal path — the one place that can say how many
   * sales it will take with it.
   */
  onVoidSelected: () => void;
  /** Tick state, owned by the page. See `useRowSelection`. */
  selection: RowSelection;
  onCloseTransactionDetail: () => void;
  /** Reopens the printable receipt or order summary for a recorded sale. */
  onOpenReceipt: (transaction: Transaction) => void;
  orderToHistoryTransaction: (order: Order) => Transaction;
}

export function POSHistoryView({
  filteredHistoryRows,
  totalRows,
  historyPage,
  onHistoryPageChange,
  historySearchTerm,
  selectedTransaction,
  onHistorySearchChange,
  onSelectTransaction,
  onVoidSelected,
  selection,
  onCloseTransactionDetail,
  onOpenReceipt,
  orderToHistoryTransaction,
}: POSHistoryViewProps) {
  return (
    <>
      <Card padding="none" className="overflow-hidden">
        <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-end">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:max-w-2xl">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-macos-text-muted" aria-hidden="true" />
              <Input type="text" aria-label="Filter transaction history" className="pl-8 text-xs" value={historySearchTerm} onChange={(e) => onHistorySearchChange(e.target.value)} />
            </div>
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
              onClick={onVoidSelected}
              aria-label={selection.count > 0 ? `Void ${selection.count} selected sale${selection.count === 1 ? '' : 's'}` : 'Void selected sales'}
              title={selection.count === 0 ? 'Tick the sales you want to void first.' : `Void ${selection.count} sale${selection.count === 1 ? '' : 's'}`}
              className="shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
                    disabled={selection.count === 0 && !filteredHistoryRows.some((row) => row.status === 'completed')}
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
                  <TableHead colSpan={5} className="font-semibold text-macos-text dark:text-zinc-100">
                    {formatSelectedCount(selection.count)}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistoryRows.map((row) => {
                const trx = row.source === 'trx' ? row.trx! : orderToHistoryTransaction(row.order!);
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
                  <TableRow key={key} className="cursor-pointer" onClick={() => onSelectTransaction(trx)}>
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
                    <TableCell className="text-macos-text-muted dark:text-zinc-500">{refDisplay}</TableCell>
                    <TableCell className="text-macos-text-muted dark:text-zinc-400">{trx.date}</TableCell>
                    <TableCell>
                      <span className="tabular-nums text-macos-text dark:text-zinc-100">{trx.items.reduce((acc, curr) => acc + curr.qty, 0)} Units</span>
                    </TableCell>
                    <TableCell><StatusLabel tone={row.source === 'trx' ? 'blue' : 'purple'}>{row.source === 'trx' ? row.trx!.paymentMethod : 'Order'}</StatusLabel></TableCell>
                    <TableCell className="text-right tabular-nums text-macos-text dark:text-zinc-100">₱{trx.total.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
              {filteredHistoryRows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-12">
                    <EmptyState title={historySearchTerm ? 'No entries match filters' : 'No POS or order history yet'} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
        <div className="border-t px-4 py-3">
          <Pagination page={historyPage} limit={filteredHistoryRows.length} total={totalRows} onPageChange={onHistoryPageChange} />
        </div>
      </Card>

      <Modal isOpen={!!selectedTransaction} onClose={onCloseTransactionDetail} title="Transaction Details" maxWidth="max-w-sm">
        {selectedTransaction && (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 scrollbar-hide">
            <div className="flex items-start justify-between border-b pb-3">
              <div className="space-y-0.5">
                <p className="text-3xs font-bold text-macos-text-muted">Reference ID</p>
                <p className="font-mono text-2xs font-bold">#{selectedTransaction.id}</p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-3xs font-bold text-macos-text-muted">Date &amp; Time</p>
                <p className="text-2xs font-medium">{selectedTransaction.date}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-3xs font-bold text-macos-text-muted">Items Purchased</p>
              <div className="max-h-36 space-y-1 overflow-y-auto pr-1 scrollbar-hide">
                {selectedTransaction.items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex items-center justify-between rounded-xl border p-2 text-2xs">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate font-bold text-macos-text dark:text-zinc-100">{item.name}</p>
                      <p className="text-3xs text-macos-text-muted">{item.qty} × ₱{item.price.toFixed(2)}</p>
                    </div>
                    <p className="shrink-0 font-mono font-bold">₱{(item.price * item.qty).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 border-t pt-3 text-2xs text-macos-text-muted">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">₱{selectedTransaction.subtotal.toFixed(2)}</span></div>
              {(selectedTransaction.discount ?? 0) > 0 && <div className="flex justify-between"><span>Discount</span><span className="font-mono">−₱{(selectedTransaction.discount ?? 0).toFixed(2)}</span></div>}
              <div className="flex justify-between"><span>VAT ({selectedTransaction.vatRatePercent ?? 12}%)</span><span className="font-mono">₱{selectedTransaction.tax.toFixed(2)}</span></div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="text-2xs font-bold text-macos-text dark:text-zinc-100">Total Amount</span>
                <span className="font-mono text-sm font-bold text-macos-text dark:text-zinc-100">₱{selectedTransaction.total.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-[#f2f2f2] p-2 dark:bg-[#3d3d3f]">
                <span className="text-3xs font-bold text-macos-text dark:text-zinc-100">Payment</span>
                <Badge variant="blue">{selectedTransaction.paymentMethod}</Badge>
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
                onClick={() => { onOpenReceipt(selectedTransaction); onCloseTransactionDetail(); }}
              >
                {selectedTransaction.paymentMethod === 'Custom Order' ? 'View Order Summary' : 'View Receipt'}
              </Button>
              <Button type="button" fullWidth onClick={onCloseTransactionDetail}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
