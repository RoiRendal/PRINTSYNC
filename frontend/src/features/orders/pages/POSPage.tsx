import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { useDesigns } from '../../../app/stores/useDesignStore';
import { useInventory } from '../../../app/stores/useInventoryStore';
import { useCustomers } from '../../../app/stores/useCustomerStore';
import { paymentsApi } from '../api/paymentsApi';
import { POSCart } from '../components/pos/POSCart';
import { POSCatalog } from '../components/pos/POSCatalog';
import { POSCheckoutModal, type ReconciliationOutcome } from '../components/pos/POSCheckoutModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { POSDesignSelectorModal } from '../components/pos/POSDesignSelectorModal';
import { POSHistoryView } from '../components/pos/POSHistoryView';
import { POSToolbar } from '../components/pos/POSToolbar';
import { useCartTotals } from '../hooks/useCartTotals';
import { useCheckoutAttemptKey } from '../hooks/useCheckoutAttemptKey';
import { useFilteredProducts } from '../hooks/useFilteredProducts';
import { printDocument, usePOSReceipts } from '../hooks/usePOSReceipts';
import { usePOSCart, type PosMode } from '../hooks/usePOSCart';
import { usePOSHistory } from '../hooks/usePOSHistory';
import { usePOSKeyboardShortcuts } from '../hooks/usePOSKeyboardShortcuts';
import { useOrderEditHydration } from '../hooks/useOrderEditHydration';
import { usePOSTransactions } from '../hooks/usePOSTransactions';
import { usePOSCheckout } from '../hooks/usePOSCheckout';
import { useOrders } from '../../../app/stores/useOrderStore';
import { emitDataChange } from '../../../shared/store/dataEvents';


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
    checkout.resetCheckout();
    setIsCheckoutModalOpen(true);
  };

  usePOSKeyboardShortcuts({
    searchRef: searchInputRef,
    enabled: !isCheckoutModalOpen && !basket.isDesignModalOpen,
    canCheckout: cart.length > 0 && view === 'pos',
    onCheckout: handleCheckout,
  });

  const checkout = usePOSCheckout({
    cart,
    totals,
    posMode,
    customerName,
    customerId,
    orderNotes,
    editingOrderId,
    editingOrderVersion,
    orders,
    beginAttempt,
    peekAttempt,
    completeAttempt,
    createPayment: paymentsApi.create,
    addOrder,
    updateOrder,
    recordCommitted,
    reconcileAttempt,
    refreshInventory,
    recordCompletedSale: receipts.recordCompletedSale,
    onAutoDismiss: () => setIsCheckoutModalOpen(false),
  });


  return (
    <div className="flex flex-col gap-5">
      {transactionError && (
        <div className="rounded-[var(--radius-card)] border bg-[var(--app-tint-red)] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700 dark:text-red-300">
          {transactionError}
        </div>
      )}

      <POSToolbar
        view={view}
        onViewChange={setView}
        posMode={posMode}
        onSelectMode={(mode) => {
          setPosMode(mode);
          basket.resetForModeSwitch();
        }}
        lastDocument={receipts.lastDocument}
        onReopenLastDocument={receipts.reopenLastDocument}
      />

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
        checkoutSuccess={checkout.checkoutSuccess}
        isSubmitting={checkout.isSubmitting}
        checkoutError={checkout.checkoutError}
        posMode={posMode}
        cart={cart}
        totals={totals}
        paymentMethod={checkout.paymentMethod}
        currencySymbol={currencySymbol}
        recovered={checkout.checkoutRecovered}
        onPaymentMethodChange={checkout.handlePaymentMethodChange}
        onConfirm={checkout.finalize}
        onClose={() => {
          setIsCheckoutModalOpen(false);
          checkout.resetCheckout();
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
