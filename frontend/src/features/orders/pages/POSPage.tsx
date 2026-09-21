import { useMemo, useRef, useState } from 'react';
import { History, ReceiptText, ShoppingBag } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { ApiError, isServerRejection } from '../../../shared/api/errors';
import { Button, SurfaceCard } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import { useDesigns } from '../../../app/stores/useDesignStore';
import { useInventory } from '../../../app/stores/useInventoryStore';
import { useCustomers } from '../../../app/stores/useCustomerStore';
import { paymentsApi, readInsufficientStock } from '../api/paymentsApi';
import { readOrderConflict } from '../api/ordersApi';
import { POSCart } from '../components/pos/POSCart';
import { POSCatalog } from '../components/pos/POSCatalog';
import {
  POSCheckoutModal,
  type CheckoutError,
  type CheckoutFailureOutcome,
  type ReconciliationOutcome,
} from '../components/pos/POSCheckoutModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { POSDesignSelectorModal } from '../components/pos/POSDesignSelectorModal';
import { POSHistoryView } from '../components/pos/POSHistoryView';
import { useCartTotals } from '../hooks/useCartTotals';
import { useCheckoutAttemptKey } from '../hooks/useCheckoutAttemptKey';
import { useFilteredProducts } from '../hooks/useFilteredProducts';
import { printDocument, usePOSReceipts } from '../hooks/usePOSReceipts';
import { usePOSCart, type PosMode } from '../hooks/usePOSCart';
import { usePOSHistory } from '../hooks/usePOSHistory';
import { usePOSKeyboardShortcuts } from '../hooks/usePOSKeyboardShortcuts';
import { useOrderEditHydration } from '../hooks/useOrderEditHydration';
import { usePOSTransactions } from '../hooks/usePOSTransactions';
import { useOrders } from '../../../app/stores/useOrderStore';
import { emitDataChange } from '../../../shared/store/dataEvents';
import type { CreateOrder } from '../types';
import { documentFromSale } from '../types/printableDocument';

const LAST_PAYMENT_METHOD_KEY = 'printsync:last-payment-method';

/**
 * What the cashier is told when a checkout's fate had to be investigated.
 *
 * Keyed on `CheckoutFailureOutcome`, which excludes `committed` by type: that is
 * a completed sale, presented as one — success panel, receipt, done — rather than
 * as a failure with a note attached.
 */
const RECONCILIATION_MESSAGE: Record<CheckoutFailureOutcome['kind'], string> = {
  'not-committed':
    'The sale did not reach the server, so nothing was charged and no stock was taken. You can try again.',
  unknown:
    'The till could not reach the server to check. Trying again will not charge twice — the same reference is reused, so a repeat is recognised as the same sale.',
};

export default function POS() {
  const { items: inventory, refresh: refreshInventory } = useInventory();
  const { designs } = useDesigns();
  const { addOrder, orders, updateOrder } = useOrders();
  const { customers } = useCustomers();
  const { vatRate, currencySymbol } = useBusinessBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * The basket, and everything typed into it.
   *
   * `editingOrderVersion` lives here rather than in the page: it is captured when
   * the cart is hydrated from an order and must never be re-read from the store,
   * which is a rule about the cart, not about the screen.
   */
  const basket = usePOSCart({ inventory, vatRate });
  const {
    cart,
    cartDiscount,
    vatRatePercent,
    customerName,
    customerId,
    orderNotes,
    editingOrderId,
    editingOrderVersion,
    hydrateFromOrder,
  } = basket;

  /**
   * The till's transaction history. Reads from the payment store (R11) so the
   * page no longer reaches past the store layer; voiding and the just-recorded
   * sale are pushed through here too.
   */
  const {
    transactions,
    error: transactionError,
    voidTransaction,
    recordCommitted,
    recordReconciled,
  } = usePOSTransactions({ inventory });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [view, setView] = useState<'pos' | 'history'>('pos');
  const [posMode, setPosMode] = useState<PosMode>('retail');
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(LAST_PAYMENT_METHOD_KEY) : null;
    return saved === 'Card' ? 'Card' : 'Cash';
  });
  /** `true` when the success on screen came from reconciling a failed attempt. */
  const [checkoutRecovered, setCheckoutRecovered] = useState(false);
  /** Every piece of paper the till can produce, frozen at the moment of sale. */
  const receipts = usePOSReceipts();

  const categories = ['All', ...new Set(inventory.map(item => item.category))];
  const filteredProducts = useFilteredProducts(inventory, searchTerm, activeCategory);
  const totals = useCartTotals(cart, cartDiscount, vatRatePercent);

  /**
   * Identifies what is being sold, so a change in the cart can be told apart from
   * a mere re-render — `updateQty` rebuilds the array even when the quantity it
   * clamps to is unchanged.
   */
  const cartSignature = useMemo(
    () => cart.map((item) => `${item.id}:${item.qty}:${item.designId ?? ''}`).join('|'),
    [cart],
  );

  /*
   * A different cart is a different sale, so the next attempt must not be able to
   * replay the previous one. A cart that has *not* changed deliberately keeps its
   * key — that is what lets a retry after a dropped response come back as the
   * original sale instead of a second charge.
   */
  const { beginAttempt, peekAttempt, completeAttempt } = useCheckoutAttemptKey(cartSignature);

  /** Sales and custom orders merged into one searchable timeline. */
  const history = usePOSHistory({ transactions, orders, inventory });

  const editOrderId = (location.state as { editOrderId?: string } | null)?.editOrderId ?? null;

  useOrderEditHydration({
    editOrderId,
    orders,
    inventory,
    navigate,
    setView,
    setPosMode,
    hydrateFromOrder,
  });

  /**
   * Asks the server whether the attempt that just failed actually committed.
   *
   * Three outcomes, and the third is the one that matters. If the lookup itself
   * fails, falling back to "nothing was charged" would be exactly the answer that
   * leads to a second charge — so an unanswerable question is reported as an
   * unanswerable question, not as a negative.
   */
  const reconcileAttempt = async (key: string): Promise<ReconciliationOutcome> => {
    try {
      const committed = await paymentsApi.findByIdempotencyKey(key);
      if (!committed) return { kind: 'not-committed' };

      // The sale exists. Adopt it, so the history table and the stock figures
      // describe what actually happened rather than what the till believed.
      recordReconciled(committed);
      // The sale exists; the history table and the stock figures now describe
      // what actually happened rather than what the till believed.
      emitDataChange('inventory');
      return { kind: 'committed', reference: committed.id };
    } catch {
      return { kind: 'unknown' };
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    // Opening a checkout is a fresh look at the cart; a message from the previous
    // attempt would only be stale noise.
    setCheckoutError(null);
    setCheckoutRecovered(false);
    setIsCheckoutModalOpen(true);
  };

  usePOSKeyboardShortcuts({
    searchRef: searchInputRef,
    enabled: !isCheckoutModalOpen && !basket.isDesignModalOpen,
    canCheckout: cart.length > 0 && view === 'pos',
    onCheckout: handleCheckout,
  });

  const finalizeTransaction = async () => {
    if (cart.length === 0) return;
    // The second click of a double-click lands while the first request is still
    // open. The idempotency key would make it harmless, but there is no reason to
    // send it at all.
    if (isSubmitting) return;
    if (posMode === 'custom' && !customerName) {
      alert('Please enter customer name for custom orders.');
      return;
    }

    const { subtotal: trxSubtotal, discount: trxDiscount, tax: trxTax, total: trxTotal } = totals;
    // Frozen before anything is sent: the success path clears the cart, and the
    // receipt must still be able to describe what was sold.
    const saleCart = cart;
    const saleTotals = totals;

    setIsSubmitting(true);
    setCheckoutError(null);
    setCheckoutRecovered(false);

    /** `true` once the sale is known to have completed — however we found out. */
    let saleCompleted = false;
    let saleRecovered = false;

    try {
      if (posMode === 'retail') {
        // One key per attempt, reused for every retry of it, so the server
        // recognises a repeat and replays the original sale instead of charging
        // again. See `useCheckoutAttemptKey`.
        const idempotencyKey = beginAttempt();

        const createdTransaction = await paymentsApi.create({
          items: saleCart.map((item) => ({ itemId: item.id, name: item.name, quantity: item.qty, unitPrice: item.price })),
          subtotal: trxSubtotal,
          discount: trxDiscount,
          tax: trxTax,
          total: trxTotal,
          paymentMethod: paymentMethod,
          paymentAmount: trxTotal,
          idempotencyKey,
        });
        completeAttempt();
        recordCommitted(createdTransaction);
        // A retail sale decrements stock server-side; the catalogue, stock alerts
        // and analytics re-read without a page reload.
        emitDataChange('inventory');
        receipts.recordCompletedSale(documentFromSale({ cart: saleCart, totals: saleTotals, paymentMethod, customerName }));
        saleCompleted = true;
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
          if (!editingOrderVersion) {
            // Unreachable in normal use — the two are set together when the cart is
            // hydrated. Failing loudly beats saving without the precondition.
            setCheckoutError({
              message: 'This order could not be saved because its version was not loaded. Reopen it from the Orders page and try again.',
              stock: null,
            });
            return;
          }
          const existingOrder = orders.find((order) => order.id === editingOrderId);
          const updated = await updateOrder(
            editingOrderId,
            {
              ...preparedOrder,
              status: existingOrder?.status ?? 'Pending',
            },
            // The version this form was built from, so a save cannot land on top of
            // an edit someone else made while this cart was open.
            editingOrderVersion,
          );
          receipts.recordCompletedSale(documentFromSale({ cart: saleCart, totals: saleTotals, paymentMethod, customerName, orderId: updated.id }), customerName);
        } else {
          const created = await addOrder(preparedOrder);
          receipts.recordCompletedSale(documentFromSale({ cart: saleCart, totals: saleTotals, paymentMethod, customerName, orderId: created.id }), customerName);
        }
        saleCompleted = true;
      }
    } catch (error) {
      const shortfall = readInsufficientStock(error);
      const conflict = readOrderConflict(error);

      /*
       * A 4xx is a verdict and needs no investigation — the API validated the
       * request and refused it, so nothing was written. Anything else leaves the
       * till genuinely unable to say whether the customer was charged, so ask.
       *
       * This is the last line of defence against a double charge, and it is
       * deliberately the *second* one: the reused idempotency key already makes
       * retrying safe. Reconciling means the cashier does not have to retry at
       * all — they get told what happened.
       */
      const attemptKey = posMode === 'retail' ? peekAttempt() : null;
      let reconciliation: CheckoutFailureOutcome | null = null;

      if (attemptKey && !isServerRejection(error)) {
        const outcome = await reconcileAttempt(attemptKey);
        if (outcome.kind === 'committed') {
          completeAttempt();
          receipts.recordCompletedSale(documentFromSale({ cart: saleCart, totals: saleTotals, paymentMethod, customerName }));
          saleCompleted = true;
          saleRecovered = true;
        } else {
          /*
           * Narrowed by the branch above, so this is a failure outcome by
           * construction. Keeping the two apart here is what lets
           * RECONCILIATION_MESSAGE be indexed without a cast — the cast that used
           * to sit below existed only because the variable was wide enough to
           * hold `committed`.
           */
          reconciliation = outcome;
        }
      }

      if (!saleCompleted) {
        setCheckoutError({
          message: reconciliation
            ? RECONCILIATION_MESSAGE[reconciliation.kind]
            : shortfall
              ? `Only ${shortfall.available} left in stock for "${shortfall.itemName}" — ${shortfall.requested} requested.`
              : conflict
                ? 'Someone else changed this order while you were editing it, so your changes were not saved. Close this and reopen the order to see their version.'
                : error instanceof ApiError
                  ? error.message
                  : 'The transaction could not be completed.',
          stock: shortfall,
          reconciliation,
        });
        // The sale was refused because our stock picture was out of date. Pull the
        // real numbers so the catalogue — and the next attempt — agree with the till.
        if (shortfall) void refreshInventory();
        return;
      }
    } finally {
      setIsSubmitting(false);
    }

    setCheckoutSuccess(true);
    setCheckoutRecovered(saleRecovered);
    basket.clearAfterSale();

    setTimeout(() => {
      setIsCheckoutModalOpen(false);
      setCheckoutSuccess(false);
      setCheckoutRecovered(false);
    }, 2000);
  };

  const handlePaymentMethodChange = (method: 'Cash' | 'Card') => {
    setPaymentMethod(method);
    localStorage.setItem(LAST_PAYMENT_METHOD_KEY, method);
  };

  return (
    <div className="flex flex-col gap-5">
      {transactionError && (
        <div className="rounded-[var(--radius-card)] border bg-[var(--app-tint-red)] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700 dark:text-red-300">
          {transactionError}
        </div>
      )}

      <SurfaceCard className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={view === 'pos' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('pos')} leftIcon={<ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />}>
            Terminal
          </Button>
          <Button variant={view === 'history' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('history')} leftIcon={<History className="h-3.5 w-3.5" aria-hidden="true" />}>
            History
          </Button>
        </div>

        <div className="flex items-center rounded-full border bg-[var(--app-surface-raised)] p-1 dark:bg-[#3d3d3f]">
          <button
            type="button"
            onClick={() => {
              setPosMode('retail');
              basket.resetForModeSwitch();
            }}
            className={cn('h-7 cursor-pointer rounded-full px-3 text-[9px] font-bold uppercase tracking-[0.18em]', posMode === 'retail' ? 'bg-macos-blue text-white' : 'text-macos-text-muted hover:bg-[var(--app-state-hover)] dark:text-zinc-400 dark:hover:bg-[#414143]')}
          >
            Retail
          </button>
          <button
            type="button"
            onClick={() => {
              setPosMode('custom');
              basket.resetForModeSwitch();
            }}
            className={cn('h-7 cursor-pointer rounded-full px-3 text-[9px] font-bold uppercase tracking-[0.18em]', posMode === 'custom' ? 'bg-macos-purple text-white' : 'text-macos-text-muted hover:bg-[var(--app-state-hover)] dark:text-zinc-400 dark:hover:bg-[#414143]')}
          >
            Custom
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/*
            Stays on screen after a sale, not just during it. The checkout dialog
            dismisses itself two seconds after confirming, so without this the
            receipt was reachable only by whoever happened to click in time.
          */}
          {receipts.lastDocument && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={receipts.reopenLastDocument}
              title={`Reopen the receipt for ${receipts.lastDocument.document.reference}`}
              leftIcon={<ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />}
              className="max-w-[240px]"
            >
              <span className="truncate">
                Last receipt · <span className="font-mono">{receipts.lastDocument.label}</span>
              </span>
            </Button>
          )}
        </div>
      </SurfaceCard>

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
            onAddToCart={(product) => basket.addToCart(product, posMode)}
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
            onCustomerNameChange={basket.setCustomerName}
            onCustomerIdChange={basket.setCustomerId}
            onOrderNotesChange={basket.setOrderNotes}
            onCartDiscountChange={basket.setCartDiscount}
            onVatRatePercentChange={basket.setVatRatePercent}
            onUpdateQty={basket.updateQty}
            onRemoveFromCart={basket.removeFromCart}
            onOpenDesignSelector={basket.openDesignSelector}
            onReset={basket.resetCart}
            onCheckout={handleCheckout}
          />
        </div>
      ) : (
        <POSHistoryView
          filteredHistoryRows={history.filteredRows}
          historySearchTerm={history.historySearchTerm}
          selectedTransaction={history.selectedTransaction}
          onHistorySearchChange={history.setHistorySearchTerm}
          onSelectTransaction={history.selectTransaction}
          onVoidTransaction={voidTransaction}
          onCloseTransactionDetail={() => history.selectTransaction(null)}
          onOpenReceipt={receipts.openHistoricalReceipt}
          orderToHistoryTransaction={history.orderToHistoryTransaction}
        />
      )}

      <POSDesignSelectorModal
        isOpen={basket.isDesignModalOpen}
        designs={designs}
        onSelect={basket.selectDesignForItem}
        onClose={basket.closeDesignSelector}
      />

      <POSCheckoutModal
        isOpen={isCheckoutModalOpen}
        checkoutSuccess={checkoutSuccess}
        isSubmitting={isSubmitting}
        checkoutError={checkoutError}
        posMode={posMode}
        cart={cart}
        totals={totals}
        paymentMethod={paymentMethod}
        currencySymbol={currencySymbol}
        recovered={checkoutRecovered}
        onPaymentMethodChange={handlePaymentMethodChange}
        onConfirm={finalizeTransaction}
        onClose={() => {
          setIsCheckoutModalOpen(false);
          setCheckoutError(null);
          setCheckoutRecovered(false);
        }}
        onPrintReceipt={() => { setIsCheckoutModalOpen(false); receipts.openReceiptModal(); }}
      />

      {/*
        Reads the frozen document, never live state: the cart is cleared the
        instant a sale completes, and a historical record has no live state to
        read at all. `onPrint` renames the tab first so the saved PDF is called
        after the receipt rather than after the application.
      */}
      <ReceiptModal
        isOpen={receipts.isReceiptModalOpen}
        onClose={receipts.closeReceiptModal}
        document={receipts.receipt}
        onPrint={() => receipts.receipt && printDocument(receipts.receipt)}
      />
    </div>
  );
}
