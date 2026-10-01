import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { useAuthStore } from '../../../app/stores/useAuthStore';
import { useDesigns } from '../../../app/stores/useDesignStore';
import { useInventory } from '../../../app/stores/useInventoryStore';
import { useCustomers } from '../../../app/stores/useCustomerStore';
import { paymentsApi } from '../api/paymentsApi';
import { POSCart } from '../components/pos/POSCart';
import { POSCatalog } from '../components/pos/POSCatalog';
import { POSCheckout, type ReconciliationOutcome } from '../components/pos/POSCheckout';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { POSDesignSelectorModal } from '../components/pos/POSDesignSelectorModal';
import { POSToolbar } from '../components/pos/POSToolbar';
import { useCartTotals } from '../hooks/useCartTotals';
import { useCheckoutAttemptKey } from '../hooks/useCheckoutAttemptKey';
import { useFilteredProducts } from '../hooks/useFilteredProducts';
import { printDocument, usePOSReceipts } from '../hooks/usePOSReceipts';
import { usePOSCart, type PosMode } from '../hooks/usePOSCart';
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
  // The cashier, for the receipt's `Sold by` line.
  const currentUser = useAuthStore((state) => state.currentUser);
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
   * The till writes its sales into the payment store (R11) so the page never
   * reaches past the store layer.
   *
   * Only the two write paths are taken here now. The list itself, the load error
   * and voiding all belong to the retail table on the Orders page — this page
   * records sales, it does not browse them. The store is a module-level
   * singleton, so a sale recorded here is already in the list that page reads.
   */
  const { recordCommitted, recordReconciled } = usePOSTransactions({ inventory });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [posMode, setPosMode] = useState<PosMode>('retail');
  /**
   * What the right column is showing.
   *
   * Checkout is a MODE of the column the cart lives in, not a dialog over it —
   * ERPNext's `.payment-container` works the same way, and a dialog floating
   * above a fixed-height shell is the state-dependent geometry that shell exists
   * to remove. `POSCart` owns its own sub-view (the list versus one line's
   * details) because that is a property of the cart, not of the page.
   */
  const [rightMode, setRightMode] = useState<'cart' | 'checkout'>('cart');
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

  /*
   * R6 moved the sales-and-orders timeline to the Orders page, and with it the
   * browser page number, the tick set, and the void batch. All of that was state
   * about a LIST this page no longer renders — `RetailSalesTable` owns it now,
   * which is the same invariant in a better place: the rows and the ticks can no
   * longer be owned by two different components that have to be kept in step.
   */

  const editOrderId = (location.state as { editOrderId?: string } | null)?.editOrderId ?? null;

  /**
   * The Orders page can also ask the till to open in a particular mode.
   *
   * The custom-orders "+" asks for Custom, so a job ticket does not begin with a
   * mode change. The retail-sales "+" asks for nothing, and that is correct
   * rather than merely convenient: `/pos` is its own route, so entering it mounts
   * this page fresh and `posMode` starts at Retail every time — there is no mode
   * left over from an earlier visit for a request to have to undo.
   */
  const requestedPosMode = (location.state as { posMode?: PosMode } | null)?.posMode ?? null;

  useEffect(() => {
    if (requestedPosMode === 'custom') setPosMode('custom');
  }, [requestedPosMode]);

  useOrderEditHydration({
    editOrderId,
    orders,
    inventory,
    navigate,
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
    setRightMode('checkout');
  };

  usePOSKeyboardShortcuts({
    searchRef: searchInputRef,
    // The checkout is a mode now, so the shortcut is suppressed while it owns the
    // column rather than while a dialog is open.
    enabled: rightMode === 'cart' && !basket.isDesignModalOpen,
    // No view guard any more: the terminal is the only thing this page shows,
    // so "is the terminal on screen" is not a question the shortcut has to ask.
    canCheckout: cart.length > 0,
    onCheckout: handleCheckout,
  });

  const checkout = usePOSCheckout({
    cart,
    totals,
    posMode,
    customerName,
    customerId,
    // Who is standing at the till, frozen onto the receipt as `Sold by`.
    soldBy: currentUser?.email,
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
    // After a sale the panel gives the column back to the cart, ready for the
    // next customer. The receipt stays reachable from the toolbar's Last receipt
    // button, so nothing is lost by leaving.
    onAutoDismiss: () => setRightMode('cart'),
  });


  /*
   * The till fills the height the shell leaves it — it does not grow a scrollbar
   * of its own. `min-h-0` is the load-bearing half: without it a flex child
   * refuses to shrink below its content, and a 40-line cart would push the page
   * taller instead of scrolling inside its own panel.
   */
  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <POSToolbar
        posMode={posMode}
        onSelectMode={(mode) => {
          setPosMode(mode);
          basket.resetForModeSwitch();
        }}
        lastDocument={receipts.lastDocument}
        onReopenLastDocument={receipts.reopenLastDocument}
        className="shrink-0"
      />

      {/*
       * Two columns at 3fr / 2fr — ERPNext's `span 6 / span 4` of ten, i.e.
       * 60/40. The cart used to be a fixed `xl:w-[23rem]` (~32% here); the
       * ratio lets both panels answer to the width instead.
       *
       * Below `xl` there is no room for two panels side by side, so they stack
       * and THIS container scrolls — the page still must not. `xl` and up is
       * where the geometry is fixed and each panel owns its own scroll.
       *
       * R6 removed the `view === 'pos' ? … : …` wrapper this used to sit in. The
       * terminal is now the only thing this page renders: the history half moved
       * to the Orders page, where records belong, and with it went the state
       * that only it read.
       */}
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:grid-rows-1 xl:overflow-hidden">
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
        {/*
          One occupant at a time. The cart and the checkout are the same column
          in two states, so the panel swaps in place and the page geometry does
          not move — which is the whole point of the fixed-height shell.
        */}
        {rightMode === 'checkout' ? (
          <POSCheckout
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
            onBack={() => { setRightMode('cart'); checkout.resetCheckout(); }}
            onPrintReceipt={receipts.openReceiptModal}
          />
        ) : (
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
            onSetLinePrice={basket.setLinePrice}
            onSetLineDiscount={basket.setLineDiscount}
            onRemoveFromCart={basket.removeFromCart}
            onOpenDesignSelector={basket.openDesignSelector}
            onReset={basket.resetCart}
            onCheckout={handleCheckout}
          />
        )}
      </div>

      <POSDesignSelectorModal
        isOpen={basket.isDesignModalOpen}
        designs={designs}
        onSelect={basket.selectDesignForItem}
        onClose={basket.closeDesignSelector}
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
        /*
         * `New Order` only when the document on screen is the sale that just
         * happened — the same object `recordCompletedSale` filed in both places,
         * so identity is the honest test. A reprint pulled from History is a
         * different document about a different sale, and offering "New Order"
         * there would describe an action the cashier did not ask for.
         */
        onNewOrder={
          receipts.receipt && receipts.receipt === receipts.lastDocument?.document
            ? receipts.closeReceiptModal
            : undefined
        }
      />

      {/*
        The void confirmation left with the list it belonged to. Reversing a sale
        is a decision about a RECORD, and the records are on the Orders page now —
        the till has no rows to tick and therefore nothing to confirm.
      */}
    </div>
  );
}
