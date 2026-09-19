import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Banknote, ChevronLeft, ChevronRight, ClipboardList, Image as ImageIcon, MessageSquare, Plus, Printer } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Select,
  getStatusBadgeVariant,
} from '../../../../shared/components/ui';
import { cn } from '../../../../shared/lib/cn';
import { useDesigns } from '../../../../app/stores/useDesignStore';
import { useInventory } from '../../../../app/stores/useInventoryStore';
import { useBusinessBranding } from '../../../../app/providers/BusinessBrandingProvider';
import type { Design } from '../../../designs/types';
import type { InventoryItem } from '../../../inventory/types';
import type { Order, OrderLineItem } from '../../types';
import { isCustomOrder } from '../../utils/orderType';
import { documentFromOrder, type PrintableDocument } from '../../types/printableDocument';
import { ReceiptModal } from '../pos/ReceiptModal';
import { PhaseProgress, workPhases } from './PhaseProgress';
import { orderPaymentsApi, type OrderPayment } from '../../api/orderPaymentsApi';
import { ApiError } from '../../../../shared/api/errors';

/**
 * Prints a document and names the saved file after it.
 *
 * Duplicated from `POSPage` deliberately rather than exported through a shared
 * module: it is four lines of browser plumbing, and the alternative is a
 * "print utils" file that exists to hold one function used in two places.
 */
function printDocument(document: PrintableDocument) {
  const previousTitle = window.document.title;
  window.document.title = `JobTicket-${document.reference.replace(/[^a-zA-Z0-9-]/g, '')}`;
  try {
    window.print();
  } finally {
    window.document.title = previousTitle;
  }
}

function ImageFallback({ label }: { label: string }) {
  return (
    <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-black/10 bg-black/[0.03] text-macos-text-muted dark:border-white/10 dark:bg-white/5">
      <ImageIcon className="h-8 w-8 opacity-35" aria-hidden="true" />
      <p className="px-3 text-center text-[10px] font-bold uppercase tracking-[0.18em]">{label}</p>
    </div>
  );
}

function getOrderLineItems(order: Order): OrderLineItem[] {
  if (order.lineItems && order.lineItems.length > 0) return order.lineItems;
  return order.item
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      quantity: order.quantity,
      designId: order.designId,
    }));
}

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onAdvancePhase: (order: Order, direction: -1 | 1) => void;
  onRefreshOrder: (id: string) => Promise<Order>;
}

export function OrderDetailModal({ order, onClose, onAdvancePhase, onRefreshOrder }: OrderDetailModalProps) {
  const { items: inventoryItems } = useInventory();
  const { designs } = useDesigns();
  const { currencySymbol } = useBusinessBranding();
  const [selectedLineItemIndex, setSelectedLineItemIndex] = useState(0);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Other'>('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  /** The order whose job ticket is currently open, or `null`. */
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null);

  const getDesign = (id?: string): Design | undefined => designs.find((d) => d.id === id);

  const selectedOrderLineItems = useMemo(() => {
    if (!order) return [];
    return getOrderLineItems(order);
  }, [order]);

  const activeLineItem = selectedOrderLineItems[selectedLineItemIndex];
  const activeLineItemDesign = getDesign(activeLineItem?.designId || order?.designId);
  const activeLineInventoryItem: InventoryItem | undefined = activeLineItem
    ? (activeLineItem.itemId
        ? inventoryItems.find((i) => i.id === activeLineItem.itemId)
        : inventoryItems.find((i) => i.name.toLowerCase() === activeLineItem.name.toLowerCase()))
    : undefined;
  const selectedOrderIsCustom = order ? isCustomOrder(order) : false;

  useEffect(() => {
    setSelectedLineItemIndex(0);
    setPayments([]);
    setPaymentError(null);
    setPaymentAmount('');
    setPaymentMethod('Cash');
    setPaymentNotes('');
    if (!order?.id) return;
    setPaymentsLoading(true);
    void orderPaymentsApi.list(order.id)
      .then((data) => { setPayments(data); setPaymentError(null); })
      .catch((err: unknown) => setPaymentError(err instanceof ApiError ? err.message : 'Failed to load payments.'))
      .finally(() => setPaymentsLoading(false));
  }, [order]);

  useEffect(() => {
    if (selectedLineItemIndex < selectedOrderLineItems.length) return;
    setSelectedLineItemIndex(0);
  }, [selectedLineItemIndex, selectedOrderLineItems.length]);

  const handleRecordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!order) return;
    const amount = parseFloat(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    try {
      await orderPaymentsApi.create({ orderId: order.id, amount, method: paymentMethod, notes: paymentNotes });
      setPaymentAmount('');
      setPaymentNotes('');
      setPaymentError(null);
      const [freshPayments] = await Promise.all([
        orderPaymentsApi.list(order.id),
        onRefreshOrder(order.id),
      ]);
      setPayments(freshPayments);
    } catch (err: unknown) {
      setPaymentError(err instanceof ApiError ? err.message : 'Payment could not be recorded.');
    }
  };

  const balanceDue = order ? (order.balanceDue ?? Math.max(0, order.amount - (order.totalPaid ?? 0))) : 0;
  const totalPaid = order ? (order.totalPaid ?? 0) : 0;

  return (
    <Modal
      isOpen={!!order}
      onClose={onClose}
      title="Order Production Detail"
      maxWidth="max-w-5xl"
    >
      {order && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-black/5 pb-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge variant={getStatusBadgeVariant(order.status)} size="md" className="mb-2">{order.status}</Badge>
              <h3 className="text-xl font-bold tracking-tight text-macos-text dark:text-zinc-100">{order.customer}</h3>
              <p className="font-mono text-xs text-macos-text-muted">#{order.id}</p>
            </div>
            <div className="flex flex-col gap-2 sm:text-right">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted">Order Date</p>
                <p className="text-sm font-bold text-macos-text dark:text-zinc-100">{order.date}</p>
              </div>
              {order.dueDate && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted">Due Date</p>
                  <p className={cn(
                    'text-sm font-bold',
                    new Date(order.dueDate) < new Date(new Date().toISOString().slice(0, 10)) && order.status !== 'Completed' && order.status !== 'Delivered'
                      ? 'text-macos-red dark:text-red-300'
                      : 'text-macos-text dark:text-zinc-100',
                  )}>
                    {order.dueDate}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <section className="space-y-2">
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted">
                  <ClipboardList className="h-3 w-3" aria-hidden="true" /> Job Specifications
                </h4>
                <Card variant="glass" padding="sm" className="divide-y divide-black/5 dark:divide-white/10">
                  <div className="flex items-start justify-between gap-4 py-2 text-xs">
                    <span className="pt-1 text-macos-text-muted">Item</span>
                    <div className="space-y-1 text-right font-bold">
                      {selectedOrderLineItems.map((lineItem, index) => (
                        <button
                          key={`${lineItem.name}-${index}`}
                          type="button"
                          onClick={() => setSelectedLineItemIndex(index)}
                          className={cn(
                            'block w-full cursor-pointer text-right underline-offset-2 transition-colors hover:underline',
                            selectedLineItemIndex === index ? 'text-macos-blue dark:text-macos-cyan' : 'text-macos-text dark:text-zinc-100',
                          )}
                        >
                          {lineItem.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between py-2 text-xs">
                    <span className="text-macos-text-muted">Quantity</span>
                    <span className="font-bold">{order.quantity} Units</span>
                  </div>
                  <div className="flex justify-between py-2 text-xs">
                    <span className="text-macos-text-muted">Unit Price</span>
                    <span className="font-bold">{currencySymbol}{(order.amount / order.quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-xs">
                    <span className="font-bold uppercase text-macos-text-muted">Total Value</span>
                    <span className="font-mono font-bold text-macos-text dark:text-zinc-100">{currencySymbol}{order.amount.toFixed(2)}</span>
                  </div>
                  {selectedOrderIsCustom && (
                    <>
                      <div className="flex justify-between py-2 text-xs">
                        <span className="font-bold uppercase text-macos-text-muted">Total Paid</span>
                        <span className="font-mono font-bold text-macos-green dark:text-green-300">{currencySymbol}{totalPaid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-2 text-xs">
                        <span className="font-bold uppercase text-macos-text-muted">Balance Due</span>
                        <span className={cn('font-mono font-bold', balanceDue > 0 ? 'text-macos-red dark:text-red-300' : 'text-macos-text dark:text-zinc-100')}>
                          {currencySymbol}{balanceDue.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </Card>
              </section>

              {order.notes && (
                <section className="space-y-2">
                  <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted">
                    <MessageSquare className="h-3 w-3" aria-hidden="true" /> Production Notes
                  </h4>
                  <div className="surface-well rounded-[var(--radius-card)] p-3 text-xs italic text-macos-text dark:text-zinc-300">
                    &ldquo;{order.notes}&rdquo;
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-4">
              <section className="space-y-2">
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted">
                  <ImageIcon className="h-3 w-3" aria-hidden="true" /> Visual Assets
                </h4>
                {selectedOrderIsCustom ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-macos-text-muted">Product</p>
                      {activeLineInventoryItem?.imageUrl ? (
                        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] surface-well">
                          <img src={activeLineInventoryItem.imageUrl} alt={activeLineInventoryItem.name} className="h-full w-full object-contain" />
                        </div>
                      ) : <ImageFallback label="No product image" />}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-macos-text-muted">Custom design</p>
                      {activeLineItemDesign ? (
                        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] surface-well">
                          <img src={activeLineItemDesign.imageUrl} alt="Custom design" className="h-full w-full object-contain" />
                          <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-white">
                            Ref: {activeLineItem?.designId || order.designId}
                          </div>
                        </div>
                      ) : <ImageFallback label="No design attached" />}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-macos-text-muted">Product</p>
                    {activeLineInventoryItem?.imageUrl ? (
                      <div className="relative aspect-square max-w-md overflow-hidden rounded-[var(--radius-card)] surface-well">
                        <img src={activeLineInventoryItem.imageUrl} alt={activeLineInventoryItem.name} className="h-full w-full object-contain" />
                      </div>
                    ) : <ImageFallback label="No product image" />}
                  </div>
                )}
              </section>
            </div>
          </div>

          {selectedOrderIsCustom && (
            <Card variant="glass" padding="md" className="space-y-4">
              <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted">
                <Banknote className="h-3 w-3" aria-hidden="true" /> Payment History
              </h4>
              {paymentError && (
                <div className="rounded-[var(--radius-card)] border border-macos-red/20 bg-macos-red/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700 dark:border-macos-red/25 dark:bg-macos-red/15 dark:text-red-300">
                  {paymentError}
                </div>
              )}
              {paymentsLoading ? (
                <p className="text-xs text-macos-text-muted">Loading payments...</p>
              ) : payments.length === 0 ? (
                <p className="text-xs text-macos-text-muted">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="surface-well flex items-center justify-between rounded-[var(--radius-card)] p-2.5 shadow-[var(--shadow-card)]">
                      <div className="flex items-center gap-2">
                        <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold', payment.method === 'Cash' ? 'bg-macos-green/14 text-macos-green' : payment.method === 'Card' ? 'bg-macos-blue/14 text-macos-blue' : 'bg-macos-purple/14 text-macos-purple')}>
                          {payment.method[0]}
                        </span>
                        <div>
                          <p className="text-[10px] font-bold text-macos-text dark:text-zinc-100">{payment.method}</p>
                          <p className="text-[9px] text-macos-text-muted">{payment.createdAt.slice(0, 10)}</p>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-macos-text dark:text-zinc-100">{currencySymbol}{payment.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleRecordPayment} className="space-y-2 border-t border-black/5 pt-3 dark:border-white/10">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-macos-text-muted">Record Payment</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" min={0.01} step="0.01" fieldSize="sm" className="text-[11px]" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required />
                  <Select fieldSize="sm" className="text-[11px]" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'Card' | 'Other')}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>
                <Input fieldSize="sm" className="text-[11px]" placeholder="Notes (optional)" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
                <Button type="submit" size="sm" fullWidth leftIcon={<Plus className="h-3 w-3" aria-hidden="true" />}>Record Payment</Button>
              </form>
            </Card>
          )}

          {order.dueDate && new Date(order.dueDate) < new Date(new Date().toISOString().slice(0, 10)) && order.status !== 'Completed' && order.status !== 'Delivered' && (
            <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-macos-red/20 bg-macos-red/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700 dark:border-macos-red/25 dark:bg-macos-red/15 dark:text-red-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              This order is overdue (due {order.dueDate}). Prioritize completion or update the customer.
            </div>
          )}

          {selectedOrderIsCustom && balanceDue > 0 && order.status === 'Ready for Pickup' && (
            <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-macos-orange/20 bg-macos-orange/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-700 dark:border-macos-orange/25 dark:bg-macos-orange/15 dark:text-orange-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Balance due of {currencySymbol}{balanceDue.toFixed(2)} remains unpaid. Confirm payment before delivery.
            </div>
          )}

          <Card variant="glass" padding="md">
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted">Update Work Phase</h4>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => onAdvancePhase(order, -1)}
                disabled={workPhases.indexOf(order.status) === 0}
                className="rounded-full"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="flex-1 space-y-2">
                <PhaseProgress status={order.status} />
                <Badge variant={getStatusBadgeVariant(order.status)} size="md">{order.status}</Badge>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => {
                  if (selectedOrderIsCustom && balanceDue > 0 && order.status === 'Ready for Pickup') {
                    if (!window.confirm(`This order has an unpaid balance of ${currencySymbol}${balanceDue.toFixed(2)}. Proceed to Delivered anyway?`)) return;
                  }
                  onAdvancePhase(order, 1);
                }}
                disabled={workPhases.indexOf(order.status) === workPhases.length - 1}
                className="rounded-full"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </Card>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              leftIcon={<Printer className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => order && setTicketOrder(order)}
            >
              Print Job Ticket
            </Button>
            <Button type="button" fullWidth onClick={onClose}>
              Close View
            </Button>
          </div>
        </div>
      )}

      {/*
        A separate dialog rather than a re-skin of this one. The job ticket is a
        physical, printable sheet that travels to the shop floor; this modal is
        an interactive console with payment forms. Printing is driven by
        `#receipt-content` in `index.css`, so nesting a ticket inside the larger
        modal would print the console around it.
      */}
      <ReceiptModal
        isOpen={ticketOrder !== null}
        onClose={() => setTicketOrder(null)}
        document={ticketOrder ? documentFromOrder(ticketOrder) : null}
        onPrint={() => ticketOrder && printDocument(documentFromOrder(ticketOrder))}
        title="Job Ticket"
      />
    </Modal>
  );
}
