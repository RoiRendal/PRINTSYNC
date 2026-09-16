import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { History, ShoppingBag, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { ApiError } from '../../../shared/api/errors';
import { Button, GlassCard } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import { useDesigns } from '../../../app/stores/useDesignStore';
import type { InventoryItem } from '../../inventory/types';
import { useInventory } from '../../../app/stores/useInventoryStore';
import { useCustomers } from '../../../app/stores/useCustomerStore';
import { paymentsApi, type PaymentTransaction } from '../api/paymentsApi';
import { POSCart } from '../components/pos/POSCart';
import { POSCatalog } from '../components/pos/POSCatalog';
import { POSCheckoutModal } from '../components/pos/POSCheckoutModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { POSDesignSelectorModal } from '../components/pos/POSDesignSelectorModal';
import { POSHistoryView, type CombinedHistoryRow } from '../components/pos/POSHistoryView';
import { useCartTotals } from '../hooks/useCartTotals';
import { useFilteredProducts } from '../hooks/useFilteredProducts';
import { useOrders } from '../../../app/stores/useOrderStore';
import { emitDataChange, subscribeToDataChanges } from '../../../shared/store/dataEvents';
import type { CartItem, CreateOrder, Order, OrderLineItem, Transaction } from '../types';

const LAST_PAYMENT_METHOD_KEY = 'printsync:last-payment-method';

/** Coalesces a burst of payment events into a single refetch. */
const HISTORY_RELOAD_DEBOUNCE_MS = 400;

export default function POS() {
  const { items: inventory } = useInventory();
  const { designs } = useDesigns();
  const { addOrder, orders, updateOrder } = useOrders();
  const { customers } = useCustomers();
  const { vatRate, currencySymbol } = useBusinessBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
  const [vatRatePercent, setVatRatePercent] = useState(vatRate);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(LAST_PAYMENT_METHOD_KEY) : null;
    return saved === 'Card' ? 'Card' : 'Cash';
  });
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | undefined>(undefined);

  const categories = ['All', ...new Set(inventory.map(item => item.category))];
  const filteredProducts = useFilteredProducts(inventory, searchTerm, activeCategory);
  const totals = useCartTotals(cart, cartDiscount, vatRatePercent);

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

  const loadTransactions = useCallback(async () => {
    try {
      const response = await paymentsApi.list();
      setTransactions(response.data.map(mapPaymentTransaction));
      setTransactionError(null);
    } catch (error: unknown) {
      setTransactionError(error instanceof ApiError ? error.message : 'Transactions could not be loaded.');
    }
  }, [mapPaymentTransaction]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  /*
   * The transaction history is a bespoke endpoint rather than a list store, so
   * it subscribes to the bus directly. Without this, a sale rung up on another
   * workstation — or a void performed here — would not appear in this table
   * until the page was reloaded.
   */
  const historyReloadTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToDataChanges((domains) => {
      if (!domains.includes('payments')) return;
      if (historyReloadTimerRef.current !== null) window.clearTimeout(historyReloadTimerRef.current);
      historyReloadTimerRef.current = window.setTimeout(() => {
        historyReloadTimerRef.current = null;
        void loadTransactions();
      }, HISTORY_RELOAD_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (historyReloadTimerRef.current !== null) {
        window.clearTimeout(historyReloadTimerRef.current);
        historyReloadTimerRef.current = null;
      }
    };
  }, [loadTransactions]);

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

  const combinedHistoryRows = useMemo((): CombinedHistoryRow[] => {
    const rows: CombinedHistoryRow[] = [
      ...transactions.map((trx) => ({ source: 'trx' as const, trx })),
      ...orders.map((order) => ({ source: 'order' as const, order })),
    ];
    rows.sort((a, b) => {
      const da = a.source === 'trx' ? a.trx!.date : a.order!.date;
      const db = b.source === 'trx' ? b.trx!.date : b.order!.date;
      return db.localeCompare(da);
    });
    return rows;
  }, [transactions, orders]);

  const filteredHistoryRows = useMemo(() => {
    const q = historySearchTerm.toLowerCase().trim();
    if (!q) return combinedHistoryRows;
    return combinedHistoryRows.filter((row) => {
      if (row.source === 'trx') {
        const t = row.trx!;
        return t.id.toLowerCase().includes(q) || t.items.some((i) => i.name.toLowerCase().includes(q));
      }
      const o = row.order!;
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
    setCustomerId(orderToEdit.customerId ?? null);
    setOrderNotes(orderToEdit.notes || '');
    setCart(hydratedCart);
    setEditingOrderId(orderToEdit.id);
    navigate('/pos', { replace: true });
  }, [inventory, location.state, navigate, orders]);

  useEffect(() => {
    const s = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
    setCartDiscount((d) => Math.min(Math.max(0, d), s));
  }, [cart]);

  useEffect(() => {
    setVatRatePercent(vatRate);
  }, [vatRate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCheckoutModalOpen || isDesignModalOpen) return;
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Enter' && !isTyping && cart.length > 0 && view === 'pos') {
        event.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCheckoutModalOpen, isDesignModalOpen, cart.length, view]);

  const resetSaleState = () => {
    setCart([]);
    setEditingOrderId(null);
    setCartDiscount(0);
    setVatRatePercent(vatRate);
    setCustomerId(null);
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

    const { subtotal: trxSubtotal, discount: trxDiscount, tax: trxTax, total: trxTotal } = totals;

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
        // A retail sale writes a payment row *and* decrements stock server-side.
        // Both domains are announced so the POS catalogue, the dashboard's
        // stock alerts, and analytics all re-read without a page reload.
        emitDataChange('payments', 'inventory');
      } catch (error) {
        setTransactionError(error instanceof ApiError ? error.message : 'The transaction could not be completed.');
        return;
      }
    } else {
      const preparedOrder: CreateOrder = {
        customer: customerName,
        customerId: customerId ?? undefined,
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
        const updated = await updateOrder(editingOrderId, {
          ...preparedOrder,
          status: existingOrder?.status ?? 'Pending',
        });
        setLastOrderId(updated.id);
      } else {
        const created = await addOrder(preparedOrder);
        setLastOrderId(created.id);
      }
    }

    setCheckoutSuccess(true);
    setCart([]);
    setCustomerName('');
    setCustomerId(null);
    setOrderNotes('');
    setEditingOrderId(null);

    setTimeout(() => {
      setIsCheckoutModalOpen(false);
      setCheckoutSuccess(false);
    }, 2000);
  };

  const handlePaymentMethodChange = (method: 'Cash' | 'Card') => {
    setPaymentMethod(method);
    localStorage.setItem(LAST_PAYMENT_METHOD_KEY, method);
  };

  const voidTransaction = async (id: string) => {
    if (window.confirm('Void this transaction? Inventory will be restored.')) {
      try {
        const voided = await paymentsApi.void(id);
        setTransactions((previous) => previous.map((transaction) => transaction.id === id ? mapPaymentTransaction(voided) : transaction));
        setTransactionError(null);
        // Voiding restores the stock the sale consumed.
        emitDataChange('payments', 'inventory');
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
          <POSCatalog
            inventory={inventory}
            filteredProducts={filteredProducts}
            categories={categories}
            searchTerm={searchTerm}
            activeCategory={activeCategory}
            currencySymbol={currencySymbol}
            searchRef={searchInputRef}
            onSearchChange={setSearchTerm}
            onCategoryChange={setActiveCategory}
            onAddToCart={addToCart}
          />
          <POSCart
            cart={cart}
            designs={designs}
            posMode={posMode}
            editingOrderId={editingOrderId}
            customers={customers}
            customerId={customerId}
            customerName={customerName}
            orderNotes={orderNotes}
            cartDiscount={cartDiscount}
            vatRatePercent={vatRatePercent}
            totals={totals}
            currencySymbol={currencySymbol}
            onCustomerNameChange={setCustomerName}
            onCustomerIdChange={setCustomerId}
            onOrderNotesChange={setOrderNotes}
            onCartDiscountChange={setCartDiscount}
            onVatRatePercentChange={setVatRatePercent}
            onUpdateQty={updateQty}
            onRemoveFromCart={removeFromCart}
            onOpenDesignSelector={openDesignSelector}
            onReset={() => { setCart([]); setCartDiscount(0); setVatRatePercent(vatRate); setCustomerId(null); }}
            onCheckout={handleCheckout}
          />
        </div>
      ) : (
        <POSHistoryView
          filteredHistoryRows={filteredHistoryRows}
          historySearchTerm={historySearchTerm}
          selectedTransaction={selectedTransaction}
          onHistorySearchChange={setHistorySearchTerm}
          onSelectTransaction={setSelectedTransaction}
          onVoidTransaction={voidTransaction}
          onCloseTransactionDetail={() => setSelectedTransaction(null)}
          orderToHistoryTransaction={orderToHistoryTransaction}
        />
      )}

      <POSDesignSelectorModal
        isOpen={isDesignModalOpen}
        designs={designs}
        onSelect={selectDesignForItem}
        onClose={() => setIsDesignModalOpen(false)}
      />

      <POSCheckoutModal
        isOpen={isCheckoutModalOpen}
        checkoutSuccess={checkoutSuccess}
        posMode={posMode}
        cart={cart}
        totals={totals}
        paymentMethod={paymentMethod}
        currencySymbol={currencySymbol}
        onPaymentMethodChange={handlePaymentMethodChange}
        onConfirm={finalizeTransaction}
        onClose={() => setIsCheckoutModalOpen(false)}
        onPrintReceipt={() => { setIsCheckoutModalOpen(false); setIsReceiptModalOpen(true); }}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        posMode={posMode}
        cart={cart}
        totals={totals}
        paymentMethod={paymentMethod}
        customerName={customerName}
        orderId={lastOrderId}
      />
    </div>
  );
}
