import { Search, Trash2 } from 'lucide-react';
import type { Transaction, Order } from '../../types';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Modal } from '../../../../shared/components/ui';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '../../../../shared/components/ui/Table';
import { EmptyState } from '../../../../shared/components/feedback/EmptyState';

export interface CombinedHistoryRow {
  source: 'trx' | 'order';
  trx?: Transaction;
  order?: Order;
}

interface POSHistoryViewProps {
  filteredHistoryRows: CombinedHistoryRow[];
  historySearchTerm: string;
  selectedTransaction: Transaction | null;
  onHistorySearchChange: (value: string) => void;
  onSelectTransaction: (transaction: Transaction) => void;
  onVoidTransaction: (id: string) => void;
  onCloseTransactionDetail: () => void;
  orderToHistoryTransaction: (order: Order) => Transaction;
}

export function POSHistoryView({
  filteredHistoryRows,
  historySearchTerm,
  selectedTransaction,
  onHistorySearchChange,
  onSelectTransaction,
  onVoidTransaction,
  onCloseTransactionDetail,
  orderToHistoryTransaction,
}: POSHistoryViewProps) {
  return (
    <>
      <Card variant="elevated" padding="none" className="overflow-hidden">
        <CardHeader className="mb-0 flex-col gap-3 border-b border-black/5 p-4 dark:border-white/10 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>POS &amp; Order History</CardTitle>
            <CardDescription>Retail transactions and custom orders in one audit trail.</CardDescription>
          </div>
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-macos-text-muted" aria-hidden="true" />
            <Input type="text" aria-label="Filter transaction history" className="pl-8 text-[11px]" value={historySearchTerm} onChange={(e) => onHistorySearchChange(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <TableContainer className="rounded-none border-0 bg-transparent shadow-none">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Ref ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistoryRows.map((row) => {
                  const trx = row.source === 'trx' ? row.trx! : orderToHistoryTransaction(row.order!);
                  const key = row.source === 'trx' ? row.trx!.id : row.order!.id;
                  const refDisplay = row.source === 'trx' ? `#${row.trx!.id.replace('TRX-', '').slice(-8)}` : row.order!.id;
                  return (
                    <TableRow key={key} className="cursor-pointer" onClick={() => onSelectTransaction(trx)}>
                      <TableCell className="font-mono text-macos-text-muted dark:text-zinc-500">{refDisplay}</TableCell>
                      <TableCell className="font-mono text-macos-text-muted dark:text-zinc-400">{trx.date}</TableCell>
                      <TableCell>
                        <span className="font-medium text-macos-text dark:text-zinc-100">{trx.items.reduce((acc, curr) => acc + curr.qty, 0)} Units</span>
                        <div className="max-w-[240px] truncate text-[9px] text-macos-text-muted dark:text-zinc-500">
                          {row.source === 'order' ? <span>{row.order!.customer} — </span> : null}
                          {trx.items.map((i) => i.name).join(', ')}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={row.source === 'trx' ? 'blue' : 'purple'}>{row.source === 'trx' ? row.trx!.paymentMethod : 'Order'}</Badge></TableCell>
                      <TableCell className="text-right font-mono font-bold text-macos-text dark:text-zinc-100">₱{trx.total.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {row.source === 'trx' ? (
                          <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onVoidTransaction(row.trx!.id); }} title="Void" className="h-8 w-8 text-macos-red hover:text-macos-red">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        ) : <span className="px-1 text-[8px] font-bold uppercase text-macos-text-muted">—</span>}
                      </TableCell>
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
      </Card>

      <Modal isOpen={!!selectedTransaction} onClose={onCloseTransactionDetail} title="Transaction Details" maxWidth="max-w-sm">
        {selectedTransaction && (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 scrollbar-hide">
            <div className="flex items-start justify-between border-b border-black/5 pb-3 dark:border-white/10">
              <div className="space-y-0.5">
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-macos-text-muted">Reference ID</p>
                <p className="font-mono text-[10px] font-bold">#{selectedTransaction.id}</p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-macos-text-muted">Date &amp; Time</p>
                <p className="text-[9px] font-medium">{selectedTransaction.date}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-macos-text-muted">Items Purchased</p>
              <div className="max-h-36 space-y-1 overflow-y-auto pr-1 scrollbar-hide">
                {selectedTransaction.items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex items-center justify-between rounded-xl border border-white/35 bg-white/45 p-2 text-[9px] dark:border-white/10 dark:bg-white/6">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate font-bold text-macos-text dark:text-zinc-100">{item.name}</p>
                      <p className="text-[7px] text-macos-text-muted">{item.qty} × ₱{item.price.toFixed(2)}</p>
                    </div>
                    <p className="shrink-0 font-mono font-bold">₱{(item.price * item.qty).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 border-t border-black/5 pt-3 text-[9px] text-macos-text-muted dark:border-white/10">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">₱{selectedTransaction.subtotal.toFixed(2)}</span></div>
              {(selectedTransaction.discount ?? 0) > 0 && <div className="flex justify-between"><span>Discount</span><span className="font-mono">−₱{(selectedTransaction.discount ?? 0).toFixed(2)}</span></div>}
              <div className="flex justify-between"><span>VAT ({selectedTransaction.vatRatePercent ?? 12}%)</span><span className="font-mono">₱{selectedTransaction.tax.toFixed(2)}</span></div>
              <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 dark:border-white/10">
                <span className="text-[9px] font-bold uppercase tracking-widest text-macos-text dark:text-zinc-100">Total Amount</span>
                <span className="font-mono text-sm font-bold text-macos-text dark:text-zinc-100">₱{selectedTransaction.total.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-black/5 p-2 dark:bg-white/8">
                <span className="text-[8px] font-bold uppercase tracking-widest text-macos-text dark:text-zinc-100">Payment</span>
                <Badge variant="blue">{selectedTransaction.paymentMethod}</Badge>
              </div>
            </div>

            <Button type="button" fullWidth onClick={onCloseTransactionDetail}>Done</Button>
          </div>
        )}
      </Modal>
    </>
  );
}
