import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Edit,
  FileText,
  History,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../../shared/api/errors';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
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
} from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import { useDesigns } from '../../designs/state/DesignContext';
import type { InventoryItem } from '../../inventory/types';
import { useInventory } from '../../inventory/state/InventoryContext';
import { paymentsApi, type PaymentTransaction } from '../api/paymentsApi';
import { useOrders } from '../state/OrderContext';
import type { CartItem, CreateOrder, Order, OrderLineItem, Transaction } from '../types';

type HistoryRow = { source: 'trx'; trx: Transaction } | { source: 'order'; order: Order };

export default function POS() {
  const { items: inventory } = useInventory();
  const { designs } = useDesigns();
  const { addOrder, orders, updateOrder } = useOrders();
  const location = useLocation();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [view, setView] = useState<'pos' | 'history'>('pos');
  const [posMode, setPosMode] = useState<'retail' | 'custom'>('retail');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [currentItemToDesign, setCurrentItemToDesign] = useState<string | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [vatRatePercent, setVatRatePercent] = useState(12);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash');

  const categories = ['All', ...new Set(inventory.map(item => item.category))];

  const mapPaymentTransaction = useCallback((transaction: PaymentTransaction): Transaction => ({
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
            imageUrl: undefined,
            createdAt: transaction.date,
            updatedAt: transaction.date,
            qty: item.quantity,
          } as CartItem);
    }),
    subtotal: transaction.subtotal,
    discount: transaction.discount > 0 ? transaction.discount : undefined,
    vatRatePercent: transaction.subtotal > transaction.discount ? (transaction.tax / (transaction.subtotal - transaction.discount)) * 100 : 0,
    tax: transaction.tax,
    total: transaction.total,
    paymentMethod: transaction.paymentMethod,
    status: transaction.status,
  }), [inventory]);

  useEffect(() => {
    let mounted = true;
    void paymentsApi.list()
      .then((loadedTransactions) => {
        if (mounted) {
          setTransactions(loadedTransactions.map(mapPaymentTransaction));
          setTransactionError(null);
        }
      })
      .catch((error: unknown) => {
        if (mounted) setTransactionError(error instanceof ApiError ? error.message : 'Transactions could not be loaded.');
      });
    return () => { mounted = false; };
  }, [mapPaymentTransaction]);

  const filteredProducts = useMemo(() => {
    return inventory.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [inventory, searchTerm, activeCategory]);

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
                const n = Math.max(1, order.item.split(',').map((s) => s.trim()).filter(Boolean).length);
                return { ...base, qty: Math.max(1, Math.floor(order.quantity / n)), isCustom: order.isCustom };
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

  const combinedHistoryRows = useMemo((): HistoryRow[] => {
    const rows: HistoryRow[] = [
      ...transactions.map((trx) => ({ source: 'trx' as const, trx })),
      ...orders.map((order) => ({ source: 'order' as const, order })),
    ];
    rows.sort((a, b) => {
      const da = a.source === 'trx' ? a.trx.date : a.order.date;
      const db = b.source === 'trx' ? b.trx.date : b.order.date;
      return db.localeCompare(da);
    });
    return rows;
  }, [transactions, orders]);

  const filteredHistoryRows = useMemo(() => {
    const q = historySearchTerm.toLowerCase().trim();
    if (!q) return combinedHistoryRows;
    return combinedHistoryRows.filter((row) => {
      if (row.source === 'trx') {
        const t = row.trx;
        return t.id.toLowerCase().includes(q) || t.items.some((i) => i.name.toLowerCase().includes(q));
      }
      const o = row.order;
      return o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.item.toLowerCase().includes(q);
    });
  }, [combinedHistoryRows, historySearchTerm]);

  useEffect(() => {
    const state = location.state as { editOrderId?: string } | null;
    const editOrderId = state?.editOrderId;
    if (!editOrderId) return;

    const orderToEdit = orders.find((order) => order.id === editOrderId);
    if (!orderToEdit) return;

    const sourceLineItems: OrderLineItem[] =
      orderToEdit.lineItems && orderToEdit.lineItems.length > 0
        ? orderToEdit.lineItems
        : orderToEdit.item
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name) => ({
              name,
              quantity: orderToEdit.quantity,
              designId: orderToEdit.designId,
            }));

    const hydratedCart: CartItem[] = sourceLineItems
      .map((lineItem): CartItem | null => {
        const inventoryItem =
          (lineItem.itemId ? inventory.find((item) => item.id === lineItem.itemId) : undefined) ??
          inventory.find((item) => item.name.toLowerCase() === lineItem.name.toLowerCase());

        if (!inventoryItem) return null;
        return {
          ...inventoryItem,
          qty: lineItem.quantity,
          isCustom: true,
          designId: lineItem.designId,
          notes: orderToEdit.notes,
        };
      })
      .filter((item): item is CartItem => item !== null);

    setView('pos');
    setPosMode('custom');
    setCustomerName(orderToEdit.customer);
    setOrderNotes(orderToEdit.notes || '');
    setCart(hydratedCart);
    setEditingOrderId(orderToEdit.id);
    navigate('/pos', { replace: true });
  }, [inventory, location.state, navigate, orders]);

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
    const discount = Math.min(Math.max(0, cartDiscount), subtotal);
    const afterDiscount = Math.max(0, subtotal - discount);
    const rate = Math.max(0, vatRatePercent);
    const tax = afterDiscount * (rate / 100);
    const total = afterDiscount + tax;
    return { subtotal, discount, afterDiscount, tax, total, vatRatePercent: rate };
  }, [cart, cartDiscount, vatRatePercent]);

  const { subtotal, discount: appliedDiscount, tax, total } = cartTotals;

  useEffect(() => {
    const s = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
    setCartDiscount((d) => Math.min(Math.max(0, d), s));
  }, [cart]);

  const resetSaleState = () => {
    setCart([]);
    setEditingOrderId(null);
    setCartDiscount(0);
    setVatRatePercent(12);
  };

  const addToCart = (product: InventoryItem) => {
    if (product.stock <= 0) return;

    const existing = cart.find(item => item.id === product.id && !item.isCustom);
    if (existing && posMode === 'retail') {
      if (existing.qty >= product.stock) return;
      setCart(cart.map(item => (item.id === product.id && !item.isCustom) ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1, isCustom: posMode === 'custom' }]);
    }
  };

  const removeFromCart = (cartIndex: number) => {
    setCart(cart.filter((_, idx) => idx !== cartIndex));
  };

  const updateQty = (cartIndex: number, delta: number) => {
    const item = cart[cartIndex];
    if (!item) return;

    if (item.qty === 1 && delta === -1) {
      removeFromCart(cartIndex);
      return;
    }

    setCart(cart.map((i, idx) => {
      if (idx === cartIndex) {
        const product = inventory.find(inv => inv.id === i.id);
        if (!product) return i;

        const newQty = Math.max(1, Math.min(i.qty + delta, product.stock));
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const openDesignSelector = (cartIndex: number) => {
    setCurrentItemToDesign(cartIndex.toString());
    setIsDesignModalOpen(true);
  };

  const selectDesignForItem = (designId: string) => {
    if (currentItemToDesign !== null) {
      const idx = parseInt(currentItemToDesign);
      setCart(cart.map((item, i) => i === idx ? { ...item, designId } : item));
      setIsDesignModalOpen(false);
      setCurrentItemToDesign(null);
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsCheckoutModalOpen(true);
  };

  const finalizeTransaction = async () => {
    if (cart.length === 0) return;
    if (posMode === 'custom' && !customerName) {
      alert('Please enter customer name for custom orders.');
      return;
    }

    const { subtotal: trxSubtotal, discount: trxDiscount, tax: trxTax, total: trxTotal } = cartTotals;

    if (posMode === 'retail') {
      try {
        const createdTransaction = await paymentsApi.create({
          items: cart.map((item) => ({ itemId: item.id, name: item.name, quantity: item.qty, unitPrice: item.price })),
          subtotal: trxSubtotal,
          discount: trxDiscount,
          tax: trxTax,
          total: trxTotal,
          paymentMethod: paymentMethod,
          paymentAmount: trxTotal,
        });
        setTransactions((previous) => [mapPaymentTransaction(createdTransaction), ...previous]);
        setTransactionError(null);
      } catch (error) {
        setTransactionError(error instanceof ApiError ? error.message : 'The transaction could not be completed.');
        return;
      }
    } else {
      const preparedOrder: CreateOrder = {
        customer: customerName,
        item: cart.map(i => i.name).join(', '),
        lineItems: cart.map(i => ({
          itemId: i.id,
          name: i.name,
          quantity: i.qty,
          designId: i.designId,
        })),
        quantity: cart.reduce((acc, i) => acc + i.qty, 0),
        amount: trxTotal,
        status: 'Pending',
        isCustom: true,
        notes: orderNotes,
        designId: cart[0]?.designId,
      };

      if (editingOrderId) {
        const existingOrder = orders.find((order) => order.id === editingOrderId);
        await updateOrder(editingOrderId, {
          ...preparedOrder,
          status: existingOrder?.status ?? 'Pending',
        });
      } else {
        await addOrder(preparedOrder);
      }
    }

    setCheckoutSuccess(true);
    setCart([]);
    setCustomerName('');
    setOrderNotes('');
    setEditingOrderId(null);
    setPaymentMethod('Cash');

    setTimeout(() => {
      setIsCheckoutModalOpen(false);
      setCheckoutSuccess(false);
    }, 2000);
  };

  const voidTransaction = async (id: string) => {
    if (window.confirm('Void this transaction? Inventory will be restored.')) {
      try {
        const voided = await paymentsApi.void(id);
        setTransactions((previous) => previous.map((transaction) => transaction.id === id ? mapPaymentTransaction(voided) : transaction));
        setTransactionError(null);
      } catch (error) {
        setTransactionError(error instanceof ApiError ? error.message : 'The transaction could not be voided.');
      }
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {transactionError && (
        <div className="rounded-[var(--radius-card)] border border-macos-red/20 bg-macos-red/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700 dark:border-macos-red/25 dark:bg-macos-red/15 dark:text-red-300">
          {transactionError}
        </div>
      )}

      <GlassCard className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={view === 'pos' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('pos')} leftIcon={<ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />}>
            Terminal
          </Button>
          <Button variant={view === 'history' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('history')} leftIcon={<History className="h-3.5 w-3.5" aria-hidden="true" />}>
            History
          </Button>
        </div>

        <div className="flex items-center rounded-full border border-white/50 bg-white/55 p-1 shadow-[var(--shadow-card)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
          <button
            type="button"
            onClick={() => {
              setPosMode('retail');
              resetSaleState();
            }}
            className={cn('h-7 cursor-pointer rounded-full px-3 text-[9px] font-bold uppercase tracking-[0.18em] transition-all', posMode === 'retail' ? 'bg-macos-blue text-white shadow-[0_6px_16px_rgb(0_122_255/0.25)]' : 'text-macos-text-muted hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10')}
          >
            Retail
          </button>
          <button
            type="button"
            onClick={() => {
              setPosMode('custom');
              resetSaleState();
            }}
            className={cn('h-7 cursor-pointer rounded-full px-3 text-[9px] font-bold uppercase tracking-[0.18em] transition-all', posMode === 'custom' ? 'bg-macos-purple text-white shadow-[0_6px_16px_rgb(175_82_222/0.24)]' : 'text-macos-text-muted hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10')}
          >
            Custom
          </button>
        </div>

        <div className="flex items-center gap-2 px-2 text-[9px] font-mono uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">
          <Sparkles className="h-3 w-3 text-macos-blue dark:text-macos-cyan" aria-hidden="true" />
          Terminal ID: AIS-POS-01
        </div>
      </GlassCard>

      {view === 'pos' ? (
        <div className="flex flex-col gap-4 xl:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Card variant="elevated" padding="md">
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
                  <Input
                    type="text"
                    aria-label="Search catalog"
                    className="pl-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        'whitespace-nowrap rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] transition-all',
                        activeCategory === cat
                          ? 'border-macos-blue bg-macos-blue text-white shadow-[0_6px_16px_rgb(0_122_255/0.22)]'
                          : 'border-white/50 bg-white/60 text-macos-text-muted hover:border-macos-blue/30 hover:text-macos-blue dark:border-white/10 dark:bg-white/8 dark:text-zinc-400 dark:hover:text-macos-cyan',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredProducts.map(product => (
                <motion.button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  whileHover={product.stock > 0 ? { y: -3 } : undefined}
                  transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                  className={cn(
                    'group flex cursor-pointer flex-col rounded-[var(--radius-card)] border border-white/60 bg-white/82 p-2 text-left shadow-[var(--shadow-card)] backdrop-blur-xl transition-all hover:border-macos-blue/35 dark:border-white/10 dark:bg-zinc-900/82 dark:hover:border-macos-blue-dark/35',
                    product.stock <= 0 && 'cursor-not-allowed opacity-50 grayscale',
                  )}
                >
                  <div className="relative mb-2 flex h-28 items-center justify-center overflow-hidden rounded-[0.65rem] border border-black/5 bg-black/[0.03] dark:border-white/10 dark:bg-white/5 xl:h-32">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex flex-col items-center text-macos-text-muted transition-colors group-hover:text-macos-blue dark:text-zinc-600 dark:group-hover:text-macos-cyan">
                        <ShoppingBag className="h-9 w-9 stroke-1" aria-hidden="true" />
                        <span className="mt-1 text-[8px] font-mono uppercase tracking-widest">No image</span>
                      </div>
                    )}
                    <div className="absolute right-1.5 top-1.5">
                      <Badge variant={product.stock <= product.reorderLevel ? 'red' : 'blue'} className="bg-white/80 dark:bg-zinc-950/70">
                        {product.stock} stock
                      </Badge>
                    </div>
                  </div>
                  <h3 className="line-clamp-2 text-[11px] font-bold uppercase tracking-tight text-macos-text dark:text-zinc-100 xl:text-[12px]">{product.name}</h3>
                  <div className="mt-2 flex items-center justify-between transition-transform group-hover:translate-x-0.5">
                    <p className="font-mono text-[10px] font-bold text-macos-text dark:text-zinc-100 xl:text-[11px]">₱{product.price.toFixed(2)}</p>
                    <Plus className="h-3.5 w-3.5 text-macos-text-muted group-hover:text-macos-blue dark:text-zinc-500 dark:group-hover:text-macos-cyan" aria-hidden="true" />
                  </div>
                </motion.button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12">
                  <EmptyState title="No catalog items found" message="Adjust the search or category filter to find printable stock." />
                </div>
              )}
            </div>
          </div>

          <GlassCard className="flex w-full flex-col overflow-hidden p-0 xl:sticky xl:top-4 xl:w-[23rem] xl:self-start">
            <div className="relative p-4">
              <div className="pointer-events-none absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 p-8 opacity-[0.04]">
                <ShoppingBag className="h-48 w-48" aria-hidden="true" />
              </div>
              <div className="relative flex items-center justify-between gap-3 border-b border-white/35 pb-3 dark:border-white/10">
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text dark:text-zinc-100">
                    {posMode === 'retail' ? 'Transaction Cart' : editingOrderId ? 'Custom Order Update' : 'Custom Order Builder'}
                  </h2>
                  <p className="mt-1 text-[11px] text-macos-text-muted dark:text-zinc-500">Liquid Glass checkout panel</p>
                </div>
                <Badge variant={posMode === 'retail' ? 'blue' : 'purple'}>{cart.length} items</Badge>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-4 pb-4 space-y-2.5 scrollbar-hide">
              {posMode === 'custom' && (
                <div className="mb-4 space-y-3 rounded-[var(--radius-card)] border border-macos-purple/20 bg-macos-purple/10 p-3 dark:border-macos-purple/25 dark:bg-macos-purple/12">
                  <label className="block space-y-1.5">
                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-purple-700 dark:text-purple-300">Client Name</span>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-purple" aria-hidden="true" />
                      <Input fieldSize="sm" className="pl-8 text-[11px]" value={customerName} onChange={(e) => setCustomerName(e.target.value)} aria-label="Client name" />
                    </div>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-purple-700 dark:text-purple-300">Production Notes</span>
                    <div className="relative">
                      <FileText className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-purple" aria-hidden="true" />
                      <Input fieldSize="sm" className="pl-8 text-[11px]" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} aria-label="Production notes" />
                    </div>
                  </label>
                </div>
              )}

              {cart.length === 0 ? (
                <EmptyState title="Build list to proceed" message="Select catalog items to stage a retail sale or custom order." className="py-10" />
              ) : (
                cart.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="rounded-[var(--radius-card)] border border-white/45 bg-white/52 p-2.5 shadow-[var(--shadow-card)] dark:border-white/10 dark:bg-white/6">
                    <div className="flex gap-3">
                      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-[0.75rem] bg-black/[0.04] dark:bg-white/8">
                        {item.designId ? (
                          <img src={designs.find(d => d.id === item.designId)?.imageUrl} alt="Selected design" className="h-full w-full object-cover" />
                        ) : item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate text-[10px] font-bold uppercase leading-tight text-macos-text dark:text-zinc-100">{item.name}</span>
                          <button type="button" onClick={() => removeFromCart(idx)} className="cursor-pointer text-macos-text-muted transition-colors hover:text-macos-red dark:text-zinc-500 dark:hover:text-red-300" aria-label={`Remove ${item.name}`}>
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        <div className="mt-2 flex items-end justify-between">
                          <div className="flex overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                            <button type="button" onClick={() => updateQty(idx, -1)} className="cursor-pointer p-1.5 hover:bg-black/5 dark:hover:bg-white/10" aria-label={`Decrease ${item.name}`}><Minus className="h-2.5 w-2.5" aria-hidden="true" /></button>
                            <span className="w-7 select-none py-1.5 text-center font-mono text-[10px]">{item.qty}</span>
                            <button type="button" onClick={() => updateQty(idx, 1)} className="cursor-pointer p-1.5 hover:bg-black/5 dark:hover:bg-white/10" aria-label={`Increase ${item.name}`}><Plus className="h-2.5 w-2.5" aria-hidden="true" /></button>
                          </div>
                          <span className="font-mono text-[10px] font-bold text-macos-text dark:text-zinc-100">₱{(item.price * item.qty).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    {posMode === 'custom' && (
                      <div className="mt-2 flex gap-2 border-t border-white/35 pt-2 dark:border-white/10">
                        <Button type="button" variant={item.designId ? 'primary' : 'secondary'} size="sm" fullWidth onClick={() => openDesignSelector(idx)} leftIcon={item.designId ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <Edit className="h-3 w-3" aria-hidden="true" />}>
                          {item.designId ? 'Change Design' : 'Select Design'}
                        </Button>
                        {item.designId && <div className="max-w-[100px] truncate rounded-full bg-black/5 px-2 py-2 text-[7px] font-mono dark:bg-white/10">{designs.find(d => d.id === item.designId)?.name}</div>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3 border-t border-white/35 bg-white/38 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono text-macos-text-muted dark:text-zinc-500"><span className="font-bold">SUBTOTAL</span><span className="text-macos-text dark:text-zinc-300">₱{subtotal.toFixed(2)}</span></div>
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-macos-text-muted dark:text-zinc-500">
                  <span className="shrink-0 font-bold">DISCOUNT (₱)</span>
                  <Input type="number" min={0} step="0.01" fieldSize="sm" className="w-24 max-w-[40%] px-2 text-right font-mono text-[10px]" value={cartDiscount} onChange={(e) => { const v = parseFloat(e.target.value); setCartDiscount(Number.isFinite(v) ? Math.max(0, v) : 0); }} aria-label="Cart discount" />
                </div>
                {appliedDiscount > 0 && <div className="flex justify-between text-[10px] font-mono text-macos-text-muted dark:text-zinc-500"><span className="font-bold">AFTER DISCOUNT</span><span className="text-macos-text dark:text-zinc-300">₱{cartTotals.afterDiscount.toFixed(2)}</span></div>}
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-macos-text-muted dark:text-zinc-500">
                  <span className="shrink-0 font-bold">VAT RATE (%)</span>
                  <Input type="number" min={0} step="0.01" fieldSize="sm" className="w-20 px-2 text-right font-mono text-[10px]" value={vatRatePercent} onChange={(e) => { const v = parseFloat(e.target.value); setVatRatePercent(Number.isFinite(v) ? Math.max(0, v) : 0); }} aria-label="VAT rate" />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-macos-text-muted dark:text-zinc-500"><span className="font-bold">VAT ({cartTotals.vatRatePercent}%)</span><span className="text-macos-text dark:text-zinc-300">₱{tax.toFixed(2)}</span></div>
                <div className="mt-2 flex justify-between border-t border-black/5 pt-3 text-xl font-bold tracking-tight text-macos-text dark:border-white/10 dark:text-zinc-100">
                  <span>{posMode === 'retail' ? 'TOTAL' : 'ORDER VAL'}</span>
                  <span className={cn('font-mono', posMode === 'retail' ? 'text-macos-text dark:text-zinc-100' : 'text-macos-purple dark:text-purple-300')}>₱{total.toFixed(2)}</span>
                </div>
              </div>

              {posMode === 'custom' && editingOrderId && <div className="text-center text-[8px] font-bold uppercase tracking-widest text-macos-purple dark:text-purple-300">Editing Order: {editingOrderId}</div>}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" onClick={() => { setCart([]); setCartDiscount(0); setVatRatePercent(12); }}>Reset</Button>
                <Button type="button" onClick={handleCheckout} disabled={cart.length === 0 || (posMode === 'custom' && !customerName)} leftIcon={<CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}>
                  {posMode === 'retail' ? 'Quick Pay' : editingOrderId ? 'Update Order' : 'Create Order'}
                </Button>
              </div>
              {posMode === 'custom' && !customerName && cart.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-[8px] font-bold uppercase text-macos-orange">
                  <AlertCircle className="h-2.5 w-2.5" aria-hidden="true" /> Client Name Required
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      ) : (
        <Card variant="elevated" padding="none" className="overflow-hidden">
          <CardHeader className="mb-0 flex-col gap-3 border-b border-black/5 p-4 dark:border-white/10 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>POS & Order History</CardTitle>
              <CardDescription>Retail transactions and custom orders in one audit trail.</CardDescription>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-macos-text-muted" aria-hidden="true" />
              <Input type="text" aria-label="Filter transaction history" className="pl-8 text-[11px]" value={historySearchTerm} onChange={(e) => setHistorySearchTerm(e.target.value)} />
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
                    const trx = row.source === 'trx' ? row.trx : orderToHistoryTransaction(row.order);
                    const key = row.source === 'trx' ? row.trx.id : row.order.id;
                    const refDisplay = row.source === 'trx' ? `#${row.trx.id.replace('TRX-', '').slice(-8)}` : row.order.id;
                    return (
                      <TableRow key={key} className="cursor-pointer" onClick={() => setSelectedTransaction(trx)}>
                        <TableCell className="font-mono text-macos-text-muted dark:text-zinc-500">{refDisplay}</TableCell>
                        <TableCell className="font-mono text-macos-text-muted dark:text-zinc-400">{trx.date}</TableCell>
                        <TableCell>
                          <span className="font-medium text-macos-text dark:text-zinc-100">{trx.items.reduce((acc, curr) => acc + curr.qty, 0)} Units</span>
                          <div className="max-w-[240px] truncate text-[9px] text-macos-text-muted dark:text-zinc-500">
                            {row.source === 'order' ? <span>{row.order.customer} — </span> : null}
                            {trx.items.map((i) => i.name).join(', ')}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={row.source === 'trx' ? 'blue' : 'purple'}>{row.source === 'trx' ? row.trx.paymentMethod : 'Order'}</Badge></TableCell>
                        <TableCell className="text-right font-mono font-bold text-macos-text dark:text-zinc-100">₱{trx.total.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          {row.source === 'trx' ? (
                            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); voidTransaction(row.trx.id); }} title="Void" className="h-8 w-8 text-macos-red hover:text-macos-red">
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
      )}

      <Modal isOpen={!!selectedTransaction} onClose={() => setSelectedTransaction(null)} title="Transaction Details" maxWidth="max-w-sm">
        {selectedTransaction && (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 scrollbar-hide">
            <div className="flex items-start justify-between border-b border-black/5 pb-3 dark:border-white/10">
              <div className="space-y-0.5">
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-macos-text-muted">Reference ID</p>
                <p className="font-mono text-[10px] font-bold">#{selectedTransaction.id}</p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-macos-text-muted">Date & Time</p>
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

            <Button type="button" fullWidth onClick={() => setSelectedTransaction(null)}>Done</Button>
          </div>
        )}
      </Modal>

      <Modal isOpen={isDesignModalOpen} onClose={() => setIsDesignModalOpen(false)} title="Select Design Template" maxWidth="max-w-4xl">
        <div className="space-y-4">
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-2 scrollbar-hide md:grid-cols-4 lg:grid-cols-5">
            {designs.map(design => (
              <motion.button
                key={design.id}
                type="button"
                onClick={() => selectDesignForItem(design.id)}
                whileHover={{ y: -3 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                className="group overflow-hidden rounded-[var(--radius-card)] border border-white/50 bg-white/72 text-left shadow-[var(--shadow-card)] backdrop-blur-xl transition-all hover:border-macos-purple/45 dark:border-white/10 dark:bg-white/8"
              >
                <div className="aspect-square border-b border-black/5 bg-black/[0.03] dark:border-white/10 dark:bg-white/5">
                  <img src={design.imageUrl} alt={design.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div className="p-2">
                  <p className="truncate text-[10px] font-bold uppercase text-macos-text dark:text-zinc-100">{design.name}</p>
                  <p className="text-[8px] uppercase tracking-widest text-macos-text-muted dark:text-zinc-500">{design.category}</p>
                </div>
              </motion.button>
            ))}
          </div>
          {designs.length === 0 && <EmptyState title="No designs found in repository" message="Upload reusable artwork before assigning a custom design." className="py-16" />}
        </div>
      </Modal>

      <Modal isOpen={isCheckoutModalOpen} onClose={() => !checkoutSuccess && setIsCheckoutModalOpen(false)} title="Process Checkout">
        <div className="space-y-6">
          {checkoutSuccess ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-macos-green/20 bg-macos-green/12 text-macos-green shadow-[var(--shadow-card)]">
                <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-macos-text dark:text-zinc-100">Transaction Successful</h4>
                <p className="text-xs text-macos-text-muted dark:text-zinc-400">Inventory updated and record saved.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-macos-text-muted dark:text-zinc-400">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Amount to Pay</span>
                  <span className="font-mono text-xl font-bold text-macos-text dark:text-zinc-100">₱{total.toFixed(2)}</span>
                </div>
                <div className="space-y-1 border-b border-black/5 pb-3 font-mono text-[9px] text-macos-text-muted dark:border-white/10 dark:text-zinc-500">
                  <div className="flex justify-between"><span>Subtotal</span><span>₱{subtotal.toFixed(2)}</span></div>
                  {appliedDiscount > 0 && <div className="flex justify-between"><span>Discount</span><span>−₱{appliedDiscount.toFixed(2)}</span></div>}
                  <div className="flex justify-between"><span>VAT ({cartTotals.vatRatePercent}%)</span><span>₱{tax.toFixed(2)}</span></div>
                </div>
              </div>

              {posMode === 'retail' && (
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-400">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant={paymentMethod === 'Cash' ? 'primary' : 'secondary'} onClick={() => setPaymentMethod('Cash')} leftIcon={<Banknote className="h-3.5 w-3.5" aria-hidden="true" />}>Cash</Button>
                    <Button type="button" variant={paymentMethod === 'Card' ? 'primary' : 'secondary'} onClick={() => setPaymentMethod('Card')} leftIcon={<CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}>Card</Button>
                  </div>
                </div>
              )}

              <div className="max-h-40 space-y-2 overflow-y-auto border-t border-black/5 pt-4 pr-2 dark:border-white/10">
                {cart.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex justify-between text-[10px]">
                    <span className="font-medium uppercase text-macos-text-muted">{item.qty}x {item.name}</span>
                    <span className="font-mono text-macos-text dark:text-zinc-300">₱{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" fullWidth onClick={() => setIsCheckoutModalOpen(false)}>Cancel</Button>
                <Button type="button" fullWidth onClick={finalizeTransaction}>Confirm & Pay</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
