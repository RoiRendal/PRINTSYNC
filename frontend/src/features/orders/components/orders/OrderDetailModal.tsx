import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, Image as ImageIcon, MessageSquare, Printer } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Modal,
  getStatusBadgeVariant,
} from '../../../../shared/components/ui';
import { cn } from '../../../../shared/lib/cn';
import { useDesigns } from '../../../designs/state/DesignContext';
import { useInventory } from '../../../inventory/state/InventoryContext';
import type { Design } from '../../../designs/types';
import type { InventoryItem } from '../../../inventory/types';
import type { Order, OrderLineItem } from '../../types';
import { isCustomOrder } from '../../utils/orderType';
import { PhaseProgress, workPhases } from './PhaseProgress';

function ImageFallback({ label }: { label: string }) {
  return (
    <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-black/10 bg-black/[0.03] text-macos-text-muted dark:border-white/10 dark:bg-white/5 dark:text-zinc-500">
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
}

export function OrderDetailModal({ order, onClose, onAdvancePhase }: OrderDetailModalProps) {
  const { items: inventoryItems } = useInventory();
  const { designs } = useDesigns();
  const [selectedLineItemIndex, setSelectedLineItemIndex] = useState(0);

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
  }, [order]);

  useEffect(() => {
    if (selectedLineItemIndex < selectedOrderLineItems.length) return;
    setSelectedLineItemIndex(0);
  }, [selectedLineItemIndex, selectedOrderLineItems.length]);

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
              <p className="font-mono text-xs text-macos-text-muted dark:text-zinc-500">#{order.id}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">Order Date</p>
              <p className="text-sm font-bold text-macos-text dark:text-zinc-100">{order.date}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <section className="space-y-2">
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">
                  <ClipboardList className="h-3 w-3" aria-hidden="true" /> Job Specifications
                </h4>
                <Card variant="glass" padding="sm" className="divide-y divide-black/5 dark:divide-white/10">
                  <div className="flex items-start justify-between gap-4 py-2 text-xs">
                    <span className="pt-1 text-macos-text-muted dark:text-zinc-500">Item</span>
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
                    <span className="text-macos-text-muted dark:text-zinc-500">Quantity</span>
                    <span className="font-bold">{order.quantity} Units</span>
                  </div>
                  <div className="flex justify-between py-2 text-xs">
                    <span className="text-macos-text-muted dark:text-zinc-500">Unit Price</span>
                    <span className="font-bold">₱{(order.amount / order.quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-xs">
                    <span className="font-bold uppercase text-macos-text-muted dark:text-zinc-500">Total Value</span>
                    <span className="font-mono font-bold text-macos-text dark:text-zinc-100">₱{order.amount.toFixed(2)}</span>
                  </div>
                </Card>
              </section>

              {order.notes && (
                <section className="space-y-2">
                  <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">
                    <MessageSquare className="h-3 w-3" aria-hidden="true" /> Production Notes
                  </h4>
                  <div className="rounded-[var(--radius-card)] border border-white/45 bg-white/50 p-3 text-xs italic text-macos-text dark:border-white/10 dark:bg-white/6 dark:text-zinc-300">
                    &ldquo;{order.notes}&rdquo;
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-4">
              <section className="space-y-2">
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">
                  <ImageIcon className="h-3 w-3" aria-hidden="true" /> Visual Assets
                </h4>
                {selectedOrderIsCustom ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Product</p>
                      {activeLineInventoryItem?.imageUrl ? (
                        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] border border-black/5 bg-white/50 dark:border-white/10 dark:bg-white/6">
                          <img src={activeLineInventoryItem.imageUrl} alt={activeLineInventoryItem.name} className="h-full w-full object-contain" />
                        </div>
                      ) : <ImageFallback label="No product image" />}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Custom design</p>
                      {activeLineItemDesign ? (
                        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] border border-black/5 bg-white/50 dark:border-white/10 dark:bg-white/6">
                          <img src={activeLineItemDesign.imageUrl} alt="Custom design" className="h-full w-full object-contain" />
                          <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
                            Ref: {activeLineItem?.designId || order.designId}
                          </div>
                        </div>
                      ) : <ImageFallback label="No design attached" />}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Product</p>
                    {activeLineInventoryItem?.imageUrl ? (
                      <div className="relative aspect-square max-w-md overflow-hidden rounded-[var(--radius-card)] border border-black/5 bg-white/50 dark:border-white/10 dark:bg-white/6">
                        <img src={activeLineInventoryItem.imageUrl} alt={activeLineInventoryItem.name} className="h-full w-full object-contain" />
                      </div>
                    ) : <ImageFallback label="No product image" />}
                  </div>
                )}
              </section>
            </div>
          </div>

          <Card variant="glass" padding="md">
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">Update Work Phase</h4>
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
                onClick={() => onAdvancePhase(order, 1)}
                disabled={workPhases.indexOf(order.status) === workPhases.length - 1}
                className="rounded-full"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </Card>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth leftIcon={<Printer className="h-3.5 w-3.5" aria-hidden="true" />}>
              Print Job Ticket
            </Button>
            <Button type="button" fullWidth onClick={onClose}>
              Close View
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
