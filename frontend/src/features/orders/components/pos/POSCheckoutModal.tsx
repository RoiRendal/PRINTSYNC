import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Printer, ShieldCheck } from 'lucide-react';
import type { InsufficientStockDetails } from '@printsync/shared-types';
import type { CartItem } from '../../types';
import type { CartTotals } from '../../hooks/useCartTotals';
import { Button, Modal } from '../../../../shared/components/ui';
import { InlineAlert, type InlineAlertTone } from '../../../../shared/components/feedback/InlineAlert';
import { cn } from '../../../../shared/lib/cn';

/**
 * What the server said about a checkout whose fate was uncertain.
 *
 * A checkout can fail without the till learning whether the customer was
 * charged — the connection dropped, the request timed out, the API answered 5xx
 * after the sale had already committed. The idempotency key makes retrying safe,
 * but the cashier still should not have to guess, because the instinct on a
 * failed payment is to ring it up again.
 *
 * `unknown` is a real outcome and must be presented as one. Reporting "nothing
 * was written" when the till could not actually ask is the single most expensive
 * mistake this UI can make.
 */
export type ReconciliationOutcome =
  | { kind: 'committed'; reference: string }
  | { kind: 'not-committed' }
  | { kind: 'unknown' };

/**
 * The outcomes that can reach this component as a **failure**.
 *
 * `committed` is excluded at the type level rather than handled at runtime. A
 * committed attempt is a completed sale and the page presents it as one — with a
 * receipt — so it has no business travelling down the error path. Leaving it in
 * the union would let a future caller do exactly that, and the generic branch
 * below would then render "The transaction could not be completed." in red over a
 * sale the customer has already paid for. Making the state unrepresentable is
 * cheaper than remembering not to create it.
 */
export type CheckoutFailureOutcome = Exclude<ReconciliationOutcome, { kind: 'committed' }>;

/**
 * Why the last checkout attempt did not go through.
 *
 * `stock` is populated only for a short-stock rejection, which is the one
 * failure the cashier can act on without leaving the till — so the modal flags
 * the exact cart line instead of leaving them to guess which item is short.
 *
 * `reconciliation` is populated only when the failure carried no verdict and the
 * till then went and asked the server what actually happened.
 */
export interface CheckoutError {
  message: string;
  stock: InsufficientStockDetails | null;
  reconciliation?: CheckoutFailureOutcome | null;
}

/**
 * How to present a reconciled checkout that did *not* commit.
 *
 * The wording carries the weight here. "Nothing was charged, safe to try again"
 * and "we could not confirm, do not ring it up again" are the same shape of event
 * to the code and completely different instructions to a cashier, so they must
 * not be allowed to collapse into one generic message — hence a distinct tone and
 * heading for each rather than one shared "something went wrong" panel.
 */
const RECONCILIATION_PANEL: Record<
  CheckoutFailureOutcome['kind'],
  { heading: string; tone: InlineAlertTone; Icon: LucideIcon }
> = {
  'not-committed': {
    heading: 'Nothing was charged — safe to try again',
    tone: 'error',
    Icon: ShieldCheck,
  },
  unknown: {
    // Retrying is genuinely safe here, because the attempt key survives a
    // failure: the retry either replays the sale that committed or creates the
    // one that did not. Saying "check History first" would be overcautious and
    // would slow the till down for no benefit.
    heading: 'Could not confirm — retrying is safe',
    tone: 'warning',
    Icon: AlertTriangle,
  },
};

interface POSCheckoutModalProps {
  isOpen: boolean;
  checkoutSuccess: boolean;
  isSubmitting: boolean;
  checkoutError: CheckoutError | null;
  posMode: 'retail' | 'custom';
  cart: CartItem[];
  totals: CartTotals;
  paymentMethod: 'Cash' | 'Card';
  currencySymbol: string;
  /**
   * `true` when the sale on screen was rescued by reconciliation — the cashier's
   * earlier attempt had committed even though the response never arrived — as
   * opposed to being created by the click that just happened. Worth saying out
   * loud, because the cashier believes the sale failed.
   */
  recovered?: boolean;
  onPaymentMethodChange: (method: 'Cash' | 'Card') => void;
  onConfirm: () => void;
  onClose: () => void;
  onPrintReceipt: () => void;
}

export function POSCheckoutModal({
  isOpen,
  checkoutSuccess,
  isSubmitting,
  checkoutError,
  posMode,
  cart,
  totals,
  paymentMethod,
  currencySymbol,
  recovered = false,
  onPaymentMethodChange,
  onConfirm,
  onClose,
  onPrintReceipt,
}: POSCheckoutModalProps) {
  const { subtotal, discount: appliedDiscount, tax, total } = totals;

  /** The panel to show for an unconfirmed checkout, or `null` for an ordinary failure. */
  const reconciliation = checkoutError?.reconciliation ?? null;
  const panel = reconciliation ? RECONCILIATION_PANEL[reconciliation.kind] : null;

  /**
   * The shortfall that applies to one cart line, or `null`.
   *
   * Done per line rather than once up front so TypeScript can narrow `stock` to
   * non-null where it is rendered.
   */
  const shortfallFor = (itemId: string): InsufficientStockDetails | null =>
    checkoutError?.stock && checkoutError.stock.itemId === itemId ? checkoutError.stock : null;

  return (
    <Modal isOpen={isOpen} onClose={() => !checkoutSuccess && !isSubmitting && onClose()} title="Process Checkout">
      <div className="space-y-6">
        {checkoutSuccess ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] border bg-[var(--app-tint-green)] text-macos-green shadow-[var(--shadow-card)]">
              <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-macos-text dark:text-zinc-100">
                {posMode === 'retail' ? 'Transaction Successful' : 'Order Created'}
              </h4>
              <p className="text-xs text-macos-text-muted dark:text-zinc-400">
                {posMode === 'retail' ? 'Inventory updated and record saved.' : 'Custom job entered into production pipeline.'}
              </p>
              {recovered && (
                <p className="mt-3 rounded-[var(--radius-card)] border bg-[var(--app-tint-blue)] px-3 py-2 text-[10px] font-semibold leading-relaxed text-macos-blue dark:text-macos-cyan">
                  This sale had already been saved — the earlier attempt did go through. Do not ring it up again.
                </p>
              )}
            </div>
            <Button type="button" variant="secondary" onClick={onPrintReceipt} leftIcon={<Printer className="h-3.5 w-3.5" aria-hidden="true" />}>
              {posMode === 'retail' ? 'Print Receipt' : 'Print Order Summary'}
            </Button>
          </div>
        ) : (
          <>
            {/*
              The failure has to live inside the dialog. The page-level banner sits
              behind this overlay, so a cashier whose sale was rejected used to see
              the button simply do nothing.
            */}
            {checkoutError && (panel ? (
              <InlineAlert
                tone={panel.tone}
                title={panel.heading}
                icon={panel.Icon}
                message={checkoutError.message}
                className="text-[10px]"
              />
            ) : (
              <InlineAlert message={checkoutError.message} className="text-[10px]" />
            ))}

            <div className="space-y-4">
              <div className="flex items-center justify-between text-macos-text-muted dark:text-zinc-400">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Amount to Pay</span>
                <span className="font-mono text-xl font-bold text-macos-text dark:text-zinc-100">{currencySymbol}{total.toFixed(2)}</span>
              </div>
              <div className="space-y-1 border-b pb-3 font-mono text-[9px] text-macos-text-muted dark:text-zinc-500">
                <div className="flex justify-between"><span>Subtotal</span><span>{currencySymbol}{subtotal.toFixed(2)}</span></div>
                {appliedDiscount > 0 && <div className="flex justify-between"><span>Discount</span><span>−{currencySymbol}{appliedDiscount.toFixed(2)}</span></div>}
                <div className="flex justify-between"><span>VAT ({totals.vatRatePercent}%)</span><span>{currencySymbol}{tax.toFixed(2)}</span></div>
              </div>
            </div>

            {posMode === 'retail' && (
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-400">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={paymentMethod === 'Cash' ? 'primary' : 'secondary'} disabled={isSubmitting} onClick={() => onPaymentMethodChange('Cash')} leftIcon={<Banknote className="h-3.5 w-3.5" aria-hidden="true" />}>Cash</Button>
                  <Button type="button" variant={paymentMethod === 'Card' ? 'primary' : 'secondary'} disabled={isSubmitting} onClick={() => onPaymentMethodChange('Card')} leftIcon={<CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}>Card</Button>
                </div>
              </div>
            )}

            <div className="max-h-40 space-y-2 overflow-y-auto border-t pt-4 pr-2">
              {cart.map((item, idx) => {
                const shortfall = shortfallFor(item.id);
                return (
                  <div key={`${item.id}-${idx}`} className="space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span className={cn('font-medium uppercase', shortfall ? 'text-red-700 dark:text-red-300' : 'text-macos-text-muted')}>
                        {item.qty}x {item.name}
                      </span>
                      <span className={cn('font-mono', shortfall ? 'text-red-700 dark:text-red-300' : 'text-macos-text dark:text-zinc-300')}>
                        {currencySymbol}{(item.price * item.qty).toFixed(2)}
                      </span>
                    </div>
                    {shortfall && (
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-red-700 dark:text-red-300">
                        Only {shortfall.available} left — {shortfall.requested} requested
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" fullWidth disabled={isSubmitting} onClick={onClose}>Cancel</Button>
              {/*
                Disabled while a sale is in flight. The idempotency key already
                makes a repeat harmless, but stopping the second request at the
                button is what keeps a double-click from looking like a hang.
              */}
              <Button type="button" fullWidth isLoading={isSubmitting} onClick={onConfirm}>
                {isSubmitting ? 'Processing…' : posMode === 'retail' ? 'Confirm & Pay' : 'Create Order'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
