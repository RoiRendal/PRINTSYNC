import { useState } from 'react';
import { ApiError, isServerRejection } from '../../../shared/api/errors';
import { emitDataChange } from '../../../shared/store/dataEvents';
import type { CartItem, CreateOrder, Order } from '../types';
import type { CartTotals } from './useCartTotals';
import type { PosMode } from './usePOSCart';
import {
  type CreatePaymentTransaction,
  type PaymentTransaction,
  readInsufficientStock,
} from '../api/paymentsApi';
import { readOrderConflict } from '../api/ordersApi';
import { documentFromSale, type PrintableDocument } from '../types/printableDocument';
import type {
  CheckoutError,
  CheckoutFailureOutcome,
  ReconciliationOutcome,
} from '../components/pos/POSCheckoutModal';

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

/** Persisted so a cashier does not re-pick Cash/Card on every sale. */
const LAST_PAYMENT_METHOD_KEY = 'printsync:last-payment-method';

export interface UsePOSCheckoutOptions {
  cart: CartItem[];
  totals: CartTotals;
  posMode: PosMode;
  customerName: string;
  customerId: string | null;
  orderNotes: string;
  editingOrderId: string | null;
  /** Captured at hydration (see `useOrderEditHydration`); passed through, never re-read here. */
  editingOrderVersion: string | null;
  orders: Order[];

  /**
   * The idempotency-key lifetime is owned by the page (R11: it must stay
   * visible there). The hook only *applies* it — begin on a fresh retail
   * attempt, peek to reconcile a dropped one, complete once a sale is known.
   */
  beginAttempt: () => string;
  peekAttempt: () => string | null;
  completeAttempt: () => void;

  /** Side-effecting collaborators, injected so the hook stays testable. */
  createPayment: (payload: CreatePaymentTransaction) => Promise<PaymentTransaction>;
  addOrder: (order: CreateOrder) => Promise<Order>;
  updateOrder: (id: string, order: CreateOrder, version: string) => Promise<Order>;
  recordCommitted: (transaction: PaymentTransaction) => void;
  reconcileAttempt: (key: string) => Promise<ReconciliationOutcome>;
  refreshInventory: () => void;
  recordCompletedSale: (document: PrintableDocument, customerName?: string) => void;

  /**
   * Closes the checkout dialog two seconds after a sale. The modal does not
   * self-dismiss and stays open on success until told, so the hook asks the page
   * to drop it once the receipt has been on screen long enough to read.
   */
  onAutoDismiss: () => void;
}

export interface POSCheckoutController {
  isSubmitting: boolean;
  checkoutError: CheckoutError | null;
  checkoutSuccess: boolean;
  checkoutRecovered: boolean;
  paymentMethod: 'Cash' | 'Card';
  /** Clears the transient checkout state (error, success, recovered). */
  resetCheckout: () => void;
  /** Persists the chosen method and feeds it to the modal. */
  handlePaymentMethodChange: (method: 'Cash' | 'Card') => void;
  /** Runs the sale. The modal's confirm button and (indirectly) Enter call this. */
  finalize: () => Promise<void>;
}

/**
 * The till's checkout, as one hook.
 *
 * This is the money path, so three invariants that were load-bearing in the page
 * are preserved here explicitly rather than implied:
 *
 *  1. **Freeze the cart before sending.** `saleCart`/`saleTotals` are captured at
 *     the top of `finalize`, before any `await`. The success path clears the live
 *     cart, and the receipt must still describe what was actually sold.
 *  2. **Reconcile only a non-4xx.** A 409/422 is a verdict — the API validated and
 *     refused, so nothing was written and there is nothing to find. Anything else
 *     leaves the till unable to say whether the customer was charged, so it asks.
 *     This is the second line of double-charge defence; the reused idempotency key
 *     is the first.
 *  3. **Complete the attempt only on success.** `completeAttempt()` is called the
 *     instant a sale is known to have landed — however it was discovered — so the
 *     next checkout is a new sale, not a replay. It is deliberately *not* called on
 *     failure: keeping the key is what makes a retry safe.
 */
export function usePOSCheckout(options: UsePOSCheckoutOptions): POSCheckoutController {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutRecovered, setCheckoutRecovered] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(LAST_PAYMENT_METHOD_KEY) : null;
    return saved === 'Card' ? 'Card' : 'Cash';
  });

  const resetCheckout = () => {
    setCheckoutError(null);
    setCheckoutSuccess(false);
    setCheckoutRecovered(false);
  };

  const handlePaymentMethodChange = (method: 'Cash' | 'Card') => {
    setPaymentMethod(method);
    if (typeof window !== 'undefined') localStorage.setItem(LAST_PAYMENT_METHOD_KEY, method);
  };

  const finalize = async () => {
    if (options.cart.length === 0) return;
    // A second click of a double-click lands while the first request is still
    // open. The idempotency key would make it harmless, but there is no reason to
    // send it at all.
    if (isSubmitting) return;
    if (options.posMode === 'custom' && !options.customerName) {
      window.alert('Please enter customer name for custom orders.');
      return;
    }

    const { subtotal: trxSubtotal, discount: trxDiscount, tax: trxTax, total: trxTotal } = options.totals;
    // INVARIANT 1 — frozen before anything is sent. See the header note.
    const saleCart = options.cart;
    const saleTotals = options.totals;

    setIsSubmitting(true);
    setCheckoutError(null);
    setCheckoutRecovered(false);

    /** `true` once the sale is known to have completed — however we found out. */
    let saleCompleted = false;
    let saleRecovered = false;

    try {
      if (options.posMode === 'retail') {
        // One key per attempt, reused for every retry of it, so the server
        // recognises a repeat and replays the original sale instead of charging
        // again. See `useCheckoutAttemptKey`.
        const idempotencyKey = options.beginAttempt();

        const createdTransaction = await options.createPayment({
          items: saleCart.map((item) => ({ itemId: item.id, name: item.name, quantity: item.qty, unitPrice: item.price })),
          subtotal: trxSubtotal,
          discount: trxDiscount,
          tax: trxTax,
          total: trxTotal,
          paymentMethod: paymentMethod,
          paymentAmount: trxTotal,
          idempotencyKey,
        });
        // INVARIANT 3 — the sale is known landed; retire the key so the next
        // checkout is a genuinely new sale.
        options.completeAttempt();
        options.recordCommitted(createdTransaction);
        // A retail sale decrements stock server-side; the catalogue, stock alerts
        // and analytics re-read without a page reload.
        emitDataChange('inventory');
        options.recordCompletedSale(
          documentFromSale({ cart: saleCart, totals: saleTotals, paymentMethod: paymentMethod, customerName: options.customerName }),
        );
        saleCompleted = true;
      } else {
        const preparedOrder: CreateOrder = {
          customer: options.customerName,
          customerId: options.customerId ?? undefined,
          item: saleCart.map((i) => i.name).join(', '),
          lineItems: saleCart.map((i) => ({
            itemId: i.id,
            name: i.name,
            quantity: i.qty,
            designId: i.designId,
          })),
          quantity: saleCart.reduce((acc, i) => acc + i.qty, 0),
          amount: trxTotal,
          status: 'Pending',
          isCustom: true,
          notes: options.orderNotes,
          designId: saleCart[0]?.designId,
        };

        if (options.editingOrderId) {
          if (!options.editingOrderVersion) {
            // Unreachable in normal use — the two are set together when the cart is
            // hydrated. Failing loudly beats saving without the precondition.
            setCheckoutError({
              message: 'This order could not be saved because its version was not loaded. Reopen it from the Orders page and try again.',
              stock: null,
            });
            return;
          }
          const existingOrder = options.orders.find((order) => order.id === options.editingOrderId);
          const updated = await options.updateOrder(
            options.editingOrderId,
            {
              ...preparedOrder,
              status: existingOrder?.status ?? 'Pending',
            },
            // The version this form was built from, so a save cannot land on top of
            // an edit someone else made while this cart was open.
            options.editingOrderVersion,
          );
          options.recordCompletedSale(
            documentFromSale({ cart: saleCart, totals: saleTotals, paymentMethod: paymentMethod, customerName: options.customerName, orderId: updated.id }),
            options.customerName,
          );
        } else {
          const created = await options.addOrder(preparedOrder);
          options.recordCompletedSale(
            documentFromSale({ cart: saleCart, totals: saleTotals, paymentMethod: paymentMethod, customerName: options.customerName, orderId: created.id }),
            options.customerName,
          );
        }
        saleCompleted = true;
      }
    } catch (error) {
      const shortfall = readInsufficientStock(error);
      const conflict = readOrderConflict(error);

      /*
       * INVARIANT 2 — a 4xx is a verdict and needs no investigation: the API
       * validated the request and refused it, so nothing was written. Anything
       * else leaves the till genuinely unable to say whether the customer was
       * charged, so ask. The reused idempotency key already makes retrying safe;
       * reconciling means the cashier does not have to retry at all.
       */
      const attemptKey = options.posMode === 'retail' ? options.peekAttempt() : null;
      let reconciliation: CheckoutFailureOutcome | null = null;

      if (attemptKey && !isServerRejection(error)) {
        const outcome = await options.reconcileAttempt(attemptKey);
        if (outcome.kind === 'committed') {
          // INVARIANT 3 — a reconciled sale is a real sale; retire the key.
          options.completeAttempt();
          options.recordCompletedSale(
            documentFromSale({ cart: saleCart, totals: saleTotals, paymentMethod: paymentMethod, customerName: options.customerName }),
          );
          saleCompleted = true;
          saleRecovered = true;
        } else {
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
        if (shortfall) void options.refreshInventory();
        return;
      }
    } finally {
      setIsSubmitting(false);
    }

    setCheckoutSuccess(true);
    setCheckoutRecovered(saleRecovered);

    // The modal stays open showing success; drop it after a beat so the receipt
    // is visible but the cashier is not stuck on a stale confirmation.
    window.setTimeout(() => {
      options.onAutoDismiss();
      setCheckoutSuccess(false);
      setCheckoutRecovered(false);
    }, 2000);
  };

  return {
    isSubmitting,
    checkoutError,
    checkoutSuccess,
    checkoutRecovered,
    paymentMethod,
    resetCheckout,
    handlePaymentMethodChange,
    finalize,
  };
}
