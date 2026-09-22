import { useShallow } from 'zustand/react/shallow';
import { paymentsApi, type PaymentTransaction } from '../../features/orders/api/paymentsApi';
import { createListStore } from '../../shared/store/createListStore';
import { emitDataChange } from '../../shared/store/dataEvents';

interface PaymentActions {
  /** Reverses a sale. Voiding restores the stock the sale consumed, so the
   *  inventory domain is announced alongside the payment one. */
  voidTransaction: (id: string) => Promise<void>;
  /** Shows a just-recorded sale immediately, before the next refetch lands. */
  prependTransaction: (transaction: PaymentTransaction) => void;
}

/**
 * The till's transaction history, as a store.
 *
 * `POSPage` used to call `paymentsApi` directly for this list — the only
 * component in the frontend that reached past the store layer (R11). It now goes
 * through here, which is what lets the `payments` domain finally have a real
 * revalidator instead of the no-op the bus used to call.
 *
 * `list` forwards no pagination query on purpose: the original `loadTransactions`
 * called `paymentsApi.list()` with nothing, and the history table is not
 * paginated, so the refetch must ask for the same thing the first load did.
 */
export const usePaymentStore = createListStore<PaymentTransaction, PaymentActions>({
  list: () => paymentsApi.list(),
  fallbackErrorMessage: 'Transactions could not be loaded.',

  actions: ({ mutateItems, setError }) => ({
    voidTransaction: async (id) => {
      try {
        const voided = await paymentsApi.void(id);
        // `replaceItem` is a store action, not part of the action context; the
        // context exposes `mutateItems`, which is the supported way to rewrite a
        // row in place.
        mutateItems((items) => items.map((item) => (item.id === voided.id ? voided : item)));
        setError(null);
        // Voiding restores the stock the sale consumed, so both domains reread.
        emitDataChange('payments', 'inventory');
      } catch (error) {
        setError(error instanceof Error ? error.message : 'The transaction could not be voided.');
      }
    },

    prependTransaction: (transaction) => {
      mutateItems((items) => [transaction, ...items]);
      setError(null);
    },
  }),
});

/** Drop-in reader for the POS history. */
export function usePayments() {
  return usePaymentStore(
    useShallow((state) => ({
      transactions: state.items,
      error: state.error,
      hasLoaded: state.hasLoaded,
      ensureLoaded: state.ensureLoaded,
      voidTransaction: state.voidTransaction,
      prependTransaction: state.prependTransaction,
    })),
  );
}
