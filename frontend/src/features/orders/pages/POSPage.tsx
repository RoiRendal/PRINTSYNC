import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { useDesigns } from '../../../app/stores/useDesignStore';
import { useInventory } from '../../../app/stores/useInventoryStore';
import { useCustomers } from '../../../app/stores/useCustomerStore';
import { DeleteConfirmModal } from '../../../shared/components/ui';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import { useRowSelection } from '../../../shared/hooks/useRowSelection';
import { usePaymentStore } from '../../../app/stores/usePaymentStore';
import type { Transaction } from '../types';
import { DEFAULT_PAGE_SIZE } from '../../../shared/store/createListStore';
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

/**
 * Rows per page in the history table. Tied to the shared store default so every
 * table in the app pages at the same size — this list is paged in the browser
 * (it is one combined in-memory list), so it does not read the store's own limit.
 */
const HISTORY_PAGE_SIZE = DEFAULT_PAGE_SIZE;


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
  /*
   * The browser page of the history list, owned here rather than inside the
   * view. It has to live above both the rows and the tick set: the rows are cut
   * to the page, and the tick set is scoped to those rows, so if the page and
   * the selection were owned in different places they could disagree about what
   * is on screen — which is exactly how a bulk action ends up pointed at rows
   * nobody looked at.
   */
  const [historyPage, setHistoryPage] = useState(1);
  const history = usePOSHistory({
    transactions,
    orders,
    inventory,
    page: historyPage,
    pageSize: HISTORY_PAGE_SIZE,
  });

  const selection = useRowSelection(
    useMemo(() => history.selectableRows.map((row) => (row.source === 'trx' ? row.trx!.id : row.order!.id)), [history.selectableRows]),
  );

  const [salesToVoid, setSalesToVoid] = useState<Transaction[]>([]);
  const [isVoiding, setIsVoiding] = useState(false);
  /** Which of a batch could not be reversed. Distinct from the store's own
   *  `transactionError`, which reports a load/void failure generically. */
  const [voidError, setVoidError] = useState<string | null>(null);

  // A new search term is a new result set, so go back to its first page. The
  // hook clamps anyway; this is what *returns* the user to page 1 rather than
  // leaving them on a page number that happens to still exist.
  useEffect(() => {
    setHistoryPage(1);
  }, [history.historySearchTerm]);

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

  /**
   * Captures the ticked sales and opens the confirmation.
   *
   * The rows are snapshotted here rather than read back off `selection` when the
   * user confirms: the list can refresh underneath an open dialog, and the
   * dialog has to name the sales that were actually ticked, not whatever happens
   * to be selected by the time Confirm gets clicked.
   */
  const openVoidConfirm = () => {
    const ids = selection.selectedIds;
    if (ids.size === 0) return;
    setSalesToVoid(transactions.filter((trx) => ids.has(trx.id)));
  };

  /**
   * Reverses every sale named in the confirmation, one at a time.
   *
   * `voidTransaction` is a single-row endpoint and adding a bulk route would be
   * a backend change this screen does not need. Void is not a delete — the sale
   * and the stock it moved stay on the record, marked reversed — which is why
   * the modal's wording is changed and why a partial failure is reported by
   * reference rather than by customer.
   *
   * `voidTransaction` swallows its own error and reports through the store, so
   * the failure branch here cannot observe it. It re-reads the list instead: a
   * sale still `completed` after the attempt did not reverse, and naming it is
   * what lets the user retry the one that failed rather than all of them.
   */
  const confirmVoidSelected = async () => {
    if (salesToVoid.length === 0 || isVoiding) return;
    const targets = salesToVoid;
    setIsVoiding(true);
    try {
      for (const sale of targets) {
        await voidTransaction(sale.id);
      }
    } finally {
      // A throw before the close below would otherwise leave Confirm spinning on
      // a dialog that never goes away.
      setIsVoiding(false);
    }
    setSalesToVoid([]);
    selection.clear();

    const stillCompleted = new Set(
      usePaymentStore.getState().items.filter((item) => item.status === 'completed').map((item) => item.id),
    );
    const failed = targets.filter((sale) => stillCompleted.has(sale.id));
    if (failed.length > 0) {
      const names = failed.map((sale) => `#${sale.id.replace('TRX-', '').slice(-8)}`).join(', ');
      setVoidError(
        `${failed.length} of ${targets.length} sales could not be voided: ${names}. ${failed.length === 1 ? 'It is' : 'They are'} still completed — try again.`,
      );
      return;
    }
    setVoidError(null);
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


  /*
   * The till fills the height the shell leaves it — it does not grow a scrollbar
   * of its own. `min-h-0` is the load-bearing half: without it a flex child
   * refuses to shrink below its content, and a 40-line cart would push the page
   * taller instead of scrolling inside its own panel.
   */
  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      {transactionError && <InlineAlert message={transactionError} className="shrink-0 text-2xs" />}

      {voidError && <InlineAlert message={voidError} className="shrink-0 text-2xs" />}

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
        className="shrink-0"
      />

      {view === 'pos' ? (
        /*
         * Two columns at 3fr / 2fr — ERPNext's `span 6 / span 4` of ten, i.e.
         * 60/40. The cart used to be a fixed `xl:w-[23rem]` (~32% here); the
         * ratio lets both panels answer to the width instead.
         *
         * Below `xl` there is no room for two panels side by side, so they stack
         * and THIS container scrolls — the page still must not. `xl` and up is
         * where the geometry is fixed and each panel owns its own scroll.
         */
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
        /*
         * Provisional, and it goes away with R6. The till no longer scrolls as a
         * page, so the history table — which is a paged list that genuinely wants
         * height — gets its own scroll area for now. R6 moves this body to the
         * Orders page, where it belongs next to the custom-orders table, and this
         * branch disappears entirely.
         */
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <POSHistoryView
          filteredHistoryRows={history.filteredRows}
          totalRows={history.totalRows}
          historyPage={historyPage}
          onHistoryPageChange={setHistoryPage}
          historySearchTerm={history.historySearchTerm}
          selectedTransaction={history.selectedTransaction}
          onHistorySearchChange={history.setHistorySearchTerm}
          onSelectTransaction={history.selectTransaction}
          onVoidSelected={openVoidConfirm}
          selection={selection}
          onCloseTransactionDetail={() => history.selectTransaction(null)}
          onOpenReceipt={receipts.openHistoricalReceipt}
          orderToHistoryTransaction={history.orderToHistoryTransaction}
        />
        </div>
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

      {/*
        Reversing a sale is not a delete: the record stays, marked voided, and
        the stock it consumed goes back on the shelf. The shared dialog says
        "This action cannot be undone", which is true of a void but reads at
        first glance like the row is about to be destroyed — and a cashier who
        believes that will not use the control when they should. The extra line
        says what actually happens, and the reference ids are named rather than
        the totals, because the id is what the slip in the customer's hand
        carries.
      */}
      <DeleteConfirmModal
        isOpen={salesToVoid.length > 0}
        itemLabels={salesToVoid.map((sale) => `#${sale.id.replace('TRX-', '').slice(-8)}`)}
        isBusy={isVoiding}
        onClose={() => setSalesToVoid([])}
        onConfirm={confirmVoidSelected}
      >
        <p className="text-sm text-app-ink dark:text-zinc-100">
          The sale is voided and the stock it used is returned to inventory. The record itself stays in the history, marked voided.
        </p>
      </DeleteConfirmModal>
    </div>
  );
}
