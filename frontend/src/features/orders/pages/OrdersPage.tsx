import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  Image as ImageIcon,
  MessageSquare,
  Printer,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GlassCard,
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  getStatusBadgeVariant,
} from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import { useDesigns } from '../../designs/state/DesignContext';
import { useInventory } from '../../inventory/state/InventoryContext';
import { useOrders } from '../state/OrderContext';
import type { Order, OrderLineItem } from '../types';
import { isCustomOrder } from '../utils/orderType';

const workPhases: Order['status'][] = [
  'Pending',
  'In Production',
  'Designing',
  'Ready for Pickup',
  'Delivered',
  'Completed',
];

type SummaryTone = 'purple' | 'blue' | 'green' | 'orange';

interface SummaryCardProps {
  label: string;
  icon: LucideIcon;
  count: number;
  tone: SummaryTone;
}

const summaryToneClasses: Record<SummaryTone, string> = {
  purple: 'from-macos-purple/20 text-purple-700 ring-macos-purple/25 dark:text-purple-300',
  blue: 'from-macos-blue/20 text-macos-blue ring-macos-blue/25 dark:text-macos-cyan',
  green: 'from-macos-green/20 text-green-700 ring-macos-green/25 dark:text-green-300',
  orange: 'from-macos-orange/20 text-orange-700 ring-macos-orange/25 dark:text-orange-300',
};

function SummaryCard({ label, icon: Icon, count, tone }: SummaryCardProps) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }}>
      <GlassCard className="flex items-center justify-between gap-3 p-3 md:p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-gradient-to-br to-white/50 shadow-[var(--shadow-card)] ring-1 dark:to-white/5', summaryToneClasses[tone])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">{label}</span>
        </div>
        <span className="font-mono text-xl font-bold tracking-tight text-macos-text dark:text-zinc-100">{count}</span>
      </GlassCard>
    </motion.div>
  );
}

function PhaseProgress({ status }: { status: Order['status'] }) {
  const activeIndex = workPhases.indexOf(status);

  return (
    <div className="flex gap-1.5">
      {workPhases.map((phase, index) => {
        const isDone = index <= activeIndex;
        return (
          <span
            key={phase}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              isDone ? 'bg-gradient-to-r from-macos-blue to-macos-cyan shadow-[0_0_10px_rgb(0_122_255/0.25)]' : 'bg-black/8 dark:bg-white/10',
            )}
          />
        );
      })}
    </div>
  );
}

function ImageFallback({ label }: { label: string }) {
  return (
    <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-black/10 bg-black/[0.03] text-macos-text-muted dark:border-white/10 dark:bg-white/5 dark:text-zinc-500">
      <ImageIcon className="h-8 w-8 opacity-35" aria-hidden="true" />
      <p className="px-3 text-center text-[10px] font-bold uppercase tracking-[0.18em]">{label}</p>
    </div>
  );
}

export default function Orders() {
  const { items: inventoryItems } = useInventory();
  const { designs } = useDesigns();
  const { orders, isLoading, error, refresh, updateOrder, deleteOrder } = useOrders();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedLineItemIndex, setSelectedLineItemIndex] = useState(0);

  const filteredOrders = orders.filter(order =>
    order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDesign = (id?: string) => designs.find(d => d.id === id);
  const getOrderLineItems = (order: Order): OrderLineItem[] => {
    if (order.lineItems && order.lineItems.length > 0) return order.lineItems;
    return order.item
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
      .map(name => ({
        name,
        quantity: order.quantity,
        designId: order.designId,
      }));
  };

  const selectedOrderLineItems = useMemo(() => {
    if (!selectedOrder) return [];
    return getOrderLineItems(selectedOrder);
  }, [selectedOrder]);

  const activeLineItem = selectedOrderLineItems[selectedLineItemIndex];
  const activeLineItemDesign = getDesign(activeLineItem?.designId || selectedOrder?.designId);
  const activeLineInventoryItem = activeLineItem
    ? (activeLineItem.itemId
        ? inventoryItems.find((i) => i.id === activeLineItem.itemId)
        : inventoryItems.find((i) => i.name.toLowerCase() === activeLineItem.name.toLowerCase()))
    : undefined;
  const selectedOrderIsCustom = selectedOrder ? isCustomOrder(selectedOrder) : false;

  const orderSummary = useMemo(() => [
    { label: 'Designing', icon: Eye, count: orders.filter(o => o.status === 'Designing').length, tone: 'purple' as const },
    { label: 'In Production', icon: Printer, count: orders.filter(o => o.status === 'In Production').length, tone: 'blue' as const },
    { label: 'Ready', icon: CheckCircle2, count: orders.filter(o => o.status === 'Ready for Pickup').length, tone: 'green' as const },
    { label: 'Total Active', icon: ClipboardList, count: orders.filter(o => o.status !== 'Completed').length, tone: 'orange' as const },
  ], [orders]);

  useEffect(() => {
    if (!selectedOrder) {
      setSelectedLineItemIndex(0);
      return;
    }
    setSelectedLineItemIndex(0);
  }, [selectedOrder]);

  useEffect(() => {
    if (selectedLineItemIndex < selectedOrderLineItems.length) return;
    setSelectedLineItemIndex(0);
  }, [selectedLineItemIndex, selectedOrderLineItems.length]);

  const updateOrderStatusByStep = async (order: Order, direction: -1 | 1) => {
    const currentIndex = workPhases.indexOf(order.status);
    if (currentIndex < 0) return;
    const nextIndex = Math.max(0, Math.min(workPhases.length - 1, currentIndex + direction));
    if (nextIndex === currentIndex) return;
    const nextStatus = workPhases[nextIndex];
    if (!nextStatus) return;
    try {
      const updated = await updateOrder(order.id, { status: nextStatus });
      if (selectedOrder?.id === order.id) setSelectedOrder(updated);
    } catch (updateError) {
      console.error('Unable to update order status:', updateError);
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!window.confirm(`Delete order ${order.id} for ${order.customer}?`)) return;
    try {
      await deleteOrder(order.id);
      if (selectedOrder?.id === order.id) setSelectedOrder(null);
    } catch (deleteError) {
      console.error('Unable to delete order:', deleteError);
    }
  };

  const handleEditOrder = (order: Order) => {
    navigate('/pos', {
      state: {
        editOrderId: order.id,
      },
    });
  };

  if (isLoading) return <LoadingState label="Loading orders" className="min-h-64" />;
  if (error) return <ErrorState message={error} onRetry={refresh} className="min-h-64" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/55 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-blue shadow-[var(--shadow-card)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 dark:text-macos-cyan">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Dispatch Queue
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-[28px]">Orders</h1>
          <p className="mt-1 text-sm text-macos-text-muted dark:text-zinc-400">
            Track active jobs, phase movement, customer artwork, and production-ready details.
          </p>
        </div>
        <Button onClick={() => navigate('/pos')} leftIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}>
          New POS Order
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:gap-4">
        {orderSummary.map((card) => <SummaryCard key={card.label} {...card} />)}
      </div>

      <Card variant="elevated" padding="none" className="overflow-hidden">
        <CardHeader className="mb-0 flex-col gap-3 border-b border-black/5 p-4 dark:border-white/10 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Active Dispatch Queue</CardTitle>
            <CardDescription>Click any row to inspect assets, notes, and phase controls.</CardDescription>
          </div>
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
            <Input
              type="text"
              placeholder="Filter active orders / client data..."
              className="pl-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent>
          <TableContainer className="rounded-none border-0 bg-transparent shadow-none">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Order ID</TableHead>
                  <TableHead>Project / Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="min-w-[260px]">Work Phase</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const phaseIndex = workPhases.indexOf(order.status);
                  return (
                    <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                      <TableCell className="font-mono font-semibold text-macos-text dark:text-zinc-100">
                        #{order.id.length > 10 ? order.id.replace('ORD-', 'PS-').slice(-8) : order.id}
                      </TableCell>
                      <TableCell>
                        <div>
                          <h3 className="font-bold text-macos-text dark:text-zinc-100 md:text-sm">{order.customer}</h3>
                          <p className="mt-0.5 max-w-xs truncate text-[10px] text-macos-text-muted dark:text-zinc-500 md:text-[11px]">{order.item} × {order.quantity} units</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isCustomOrder(order) ? 'purple' : 'gray'}>{isCustomOrder(order) ? 'Custom' : 'Retail'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-[300px] items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={phaseIndex === 0}
                            onClick={(event) => {
                              event.stopPropagation();
                              updateOrderStatusByStep(order, -1);
                            }}
                            title="Back step"
                            className="h-7 w-7 rounded-full"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <PhaseProgress status={order.status} />
                            <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={phaseIndex === workPhases.length - 1}
                            onClick={(event) => {
                              event.stopPropagation();
                              updateOrderStatusByStep(order, 1);
                            }}
                            title="Next step"
                            className="h-7 w-7 rounded-full"
                          >
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-macos-text dark:text-zinc-100">₱{order.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEditOrder(order);
                            }}
                            title="Edit order in POS"
                            className="h-8 w-8"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteOrder(order);
                            }}
                            title="Delete order"
                            className="h-8 w-8 text-macos-red hover:text-macos-red"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="View details">
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="py-12">
                      <div className="text-center text-sm text-macos-text-muted dark:text-zinc-500">No matching orders found.</div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>

        <div className="glass-toolbar flex justify-center px-3 py-3 text-[9px] font-bold uppercase tracking-[0.24em] text-macos-text-muted dark:text-zinc-500">
          End of Active Dispatch Queue
        </div>
      </Card>

      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title="Order Production Detail"
        maxWidth="max-w-5xl"
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 border-b border-black/5 pb-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge variant={getStatusBadgeVariant(selectedOrder.status)} size="md" className="mb-2">{selectedOrder.status}</Badge>
                <h3 className="text-xl font-bold tracking-tight text-macos-text dark:text-zinc-100">{selectedOrder.customer}</h3>
                <p className="font-mono text-xs text-macos-text-muted dark:text-zinc-500">#{selectedOrder.id}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">Order Date</p>
                <p className="text-sm font-bold text-macos-text dark:text-zinc-100">{selectedOrder.date}</p>
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
                      <span className="font-bold">{selectedOrder.quantity} Units</span>
                    </div>
                    <div className="flex justify-between py-2 text-xs">
                      <span className="text-macos-text-muted dark:text-zinc-500">Unit Price</span>
                      <span className="font-bold">₱{(selectedOrder.amount / selectedOrder.quantity).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 text-xs">
                      <span className="font-bold uppercase text-macos-text-muted dark:text-zinc-500">Total Value</span>
                      <span className="font-mono font-bold text-macos-text dark:text-zinc-100">₱{selectedOrder.amount.toFixed(2)}</span>
                    </div>
                  </Card>
                </section>

                {selectedOrder.notes && (
                  <section className="space-y-2">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">
                      <MessageSquare className="h-3 w-3" aria-hidden="true" /> Production Notes
                    </h4>
                    <div className="rounded-[var(--radius-card)] border border-white/45 bg-white/50 p-3 text-xs italic text-macos-text dark:border-white/10 dark:bg-white/6 dark:text-zinc-300">
                      “{selectedOrder.notes}”
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
                              Ref: {activeLineItem?.designId || selectedOrder.designId}
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
                  onClick={() => updateOrderStatusByStep(selectedOrder, -1)}
                  disabled={workPhases.indexOf(selectedOrder.status) === 0}
                  className="rounded-full"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <div className="flex-1 space-y-2">
                  <PhaseProgress status={selectedOrder.status} />
                  <Badge variant={getStatusBadgeVariant(selectedOrder.status)} size="md">{selectedOrder.status}</Badge>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => updateOrderStatusByStep(selectedOrder, 1)}
                  disabled={workPhases.indexOf(selectedOrder.status) === workPhases.length - 1}
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
              <Button type="button" fullWidth onClick={() => setSelectedOrder(null)}>
                Close View
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
