import { useState } from 'react';
import { CheckCircle2, ChevronLeft, Printer } from '../../../../shared/components/ui/icons';
import type { InsufficientStockDetails } from '@printsync/shared-types';
import type { CartItem } from '../../types';
import type { CartTotals } from '../../hooks/useCartTotals';
import { Badge, Button, Input, SegmentedControl, SurfaceCard } from '../../../../shared/components/ui';
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
 * failure the cashier can act on without leaving the till — so the panel flags
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
  { heading: string; tone: InlineAlertTone }
> = {
  'not-committed': {
    heading: 'Nothing was charged — safe to try again',
    tone: 'error',
  },
  unknown: {
    // Retrying is genuinely safe here, because the attempt key survives a
    // failure: the retry either replays the sale that committed or creates the
    // one that did not. Saying "check History first" would be overcautious and
    // would slow the till down for no benefit.
    heading: 'Could not confirm — retrying is safe',
    tone: 'warning',
  },
};

interface POSCheckoutProps {
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
  /** Leaves the checkout and gives the right column back to the cart. */
  onBack: () => void;
  onPrintReceipt: () => void;
}

/**
 * Checkout, as the right column's occupant rather than a dialog over it.
 *
 * ERPNext's `.payment-container` is a mode of the same column the cart lives in,
 * not an overlay: the cashier looks at one panel and the panel changes what it
 * is for. That is why this is a `SurfaceCard` with the cart's own proportions
 * rather than a `Modal` — a dialog floating over a fixed-height shell is exactly
 * the state-dependent geometry the fixed shell exists to remove, and it also hid
 * the failure message behind its own scrim (the old modal had to say so in a
 * comment).
 */
export function POSCheckout({
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
  onBack,
  onPrintReceipt,
}: POSCheckoutProps) {
  const { subtotal, discount: appliedDiscount, tax, total } = totals;

  /**
   * Cash the customer put down. `null` means "exactly the total", which is the
   * overwhelmingly common case and needs no typing — so the field starts empty
   * and an empty field is not a shortfall.
   */
  const [cashReceived, setCashReceived] = useState<number | null>(null);
  const isCash = posMode === 'retail' && paymentMethod === 'Cash';
  const paid = isCash && cashReceived !== null ? cashReceived : total;
  const remaining = total - paid;

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
    <SurfaceCard className="flex w-full min-w-0 shrink-0 flex-col overflow-hidden p-0 xl:h-full xl:shrink">
      <div className="shrink-0 border-b border-[var(--app-border-hairline)] p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="flex cursor-pointer items-center gap-1.5 text-2xs font-bold text-app-text-muted hover:text-app-ink disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
            Back to cart
          </button>
          <Badge variant="accent">{cart.length} items</Badge>
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {checkoutSuccess ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-10 text-center">
            {/* The tick is bare and carries no hue — the 64px ringed green tile
                around it drew a box around an icon, and the green only repeated
                what the check shape and the heading below it already say. It
                takes the same muted ink as the rest of the feedback family, so a
                success reads as a state the page is in rather than a status light. */}
            <span className="text-app-text-muted dark:text-zinc-400">
              <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
            </span>
            <div>
              <h4 className="text-lg font-bold text-app-ink dark:text-zinc-100">
                {posMode === 'retail' ? 'Transaction Successful' : 'Order Created'}
              </h4>
              <p className="text-xs text-app-text-muted dark:text-zinc-400">
                {posMode === 'retail' ? 'Inventory updated and record saved.' : 'Custom job entered into production pipeline.'}
              </p>
              {recovered && (
                <p className="mt-3 rounded-[var(--radius-card)] border bg-[var(--app-tint-accent)] px-3 py-2 text-2xs font-semibold leading-relaxed text-app-accent dark:text-app-accent-soft">
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
            {/* The failure lives in this panel, which is now the column the
                cashier is looking at — there is no overlay to hide it behind. */}
            {checkoutError && (panel ? (
              <InlineAlert
                tone={panel.tone}
                title={panel.heading}
                message={checkoutError.message}
                className="text-2xs"
              />
            ) : (
              <InlineAlert message={checkoutError.message} className="text-2xs" />
            ))}

            <div className="space-y-1 border-b border-[var(--app-border-hairline)] pb-3 tabular-nums text-2xs text-app-text-muted dark:text-zinc-500">
              <div className="flex justify-between"><span>Subtotal</span><span>{currencySymbol}{subtotal.toFixed(2)}</span></div>
              {totals.lineDiscounts > 0 && (
                <div className="flex justify-between"><span>Line discounts</span><span>−{currencySymbol}{totals.lineDiscounts.toFixed(2)}</span></div>
              )}
              {appliedDiscount > 0 && <div className="flex justify-between"><span>Discount</span><span>−{currencySymbol}{appliedDiscount.toFixed(2)}</span></div>}
              <div className="flex justify-between"><span>VAT ({totals.vatRatePercent}%)</span><span>{currencySymbol}{tax.toFixed(2)}</span></div>
            </div>

            {posMode === 'retail' && (
              <div className="space-y-2">
                <span className="block text-2xs font-bold text-app-text-muted dark:text-zinc-400">Payment Method</span>
                {/*
                  Cash/Card was a Button pair with `variant` keyed off the
                  selection, so one of the two was always the darkest thing in the
                  panel — competing with "Confirm & Pay" directly beneath it for
                  the same attention. As a segmented control the choice reads as a
                  choice and the confirm button keeps the one dark slot.
                */}
                <SegmentedControl
                  aria-label="Payment method"
                  fill
                  disabled={isSubmitting}
                  value={paymentMethod}
                  onChange={onPaymentMethodChange}
                  options={[
                    { value: 'Cash', label: 'Cash' },
                    { value: 'Card', label: 'Card' },
                  ]}
                />
              </div>
            )}

            {/*
              Cash received. Only for cash: a card is tendered for the exact
              amount by definition, so there is nothing for the cashier to type
              and nothing to give back.
            */}
            {isCash && (
              <label className="block space-y-1.5">
                <span className="text-2xs font-bold text-app-text-muted dark:text-zinc-400">Cash received ({currencySymbol})</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  fieldSize="sm"
                  className="text-right tabular-nums text-sm"
                  value={cashReceived ?? ''}
                  placeholder={total.toFixed(2)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setCashReceived(e.target.value === '' ? null : Number.isFinite(v) ? Math.max(0, v) : null);
                  }}
                  aria-label="Cash received"
                />
              </label>
            )}

            <div className="max-h-40 space-y-2 overflow-y-auto border-t border-[var(--app-border-hairline)] pt-4 pr-2">
              {cart.map((item, idx) => {
                const shortfall = shortfallFor(item.id);
                const lineNet = item.price * item.qty - Math.min(item.lineDiscount ?? 0, item.price * item.qty);
                return (
                  <div key={`${item.id}-${idx}`} className="space-y-0.5">
                    <div className="flex justify-between text-2xs">
                      <span className={cn('font-medium', shortfall ? 'text-red-700 dark:text-red-300' : 'text-app-text-muted')}>
                        {item.qty}x {item.name}
                      </span>
                      <span className={cn('tabular-nums', shortfall ? 'text-red-700 dark:text-red-300' : 'text-app-ink dark:text-zinc-300')}>
                        {currencySymbol}{lineNet.toFixed(2)}
                      </span>
                    </div>
                    {shortfall && (
                      <InlineAlert
                        variant="inline"
                        className="text-2xs"
                        message={`Only ${shortfall.available} left — ${shortfall.requested} requested`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {!checkoutSuccess && (
        <div className="shrink-0 space-y-3 border-t border-[var(--app-border-hairline)] p-4">
          {/*
            ERPNext's three-cell totals strip. It only says anything because the
            cashier can enter what the customer handed over: with `Paid Amount`
            pinned to the total, `Remaining Amount` would be a hard-coded zero in
            a coloured box — ornament, which R19–R25 spent four rounds removing.
            The strip is what the tendered field is FOR.

            Only the Remaining VALUE carries a hue, and only when it means
            something: red while the customer is short (and the sale cannot be
            confirmed), green when change is due. That is the D5 carve-out, and
            it stays inside this strip — no other figure on the till is coloured.
          */}
          <div className="grid grid-cols-3 divide-x divide-[var(--app-border-hairline)] rounded-[var(--radius-card)] border border-[var(--app-border-hairline)]">
            <div className="px-3 py-2">
              <span className="block text-3xs font-bold text-app-text-muted dark:text-zinc-400">Grand Total</span>
              <span className="tabular-nums text-xs font-bold text-app-ink dark:text-zinc-100">{currencySymbol}{total.toFixed(2)}</span>
            </div>
            <div className="px-3 py-2">
              <span className="block text-3xs font-bold text-app-text-muted dark:text-zinc-400">Paid Amount</span>
              <span className="tabular-nums text-xs font-bold text-app-ink dark:text-zinc-100">{currencySymbol}{paid.toFixed(2)}</span>
            </div>
            <div className="px-3 py-2">
              <span className="block text-3xs font-bold text-app-text-muted dark:text-zinc-400">
                {remaining > 0 ? 'Remaining' : 'Change'}
              </span>
              <span
                className={cn(
                  'tabular-nums text-xs font-bold',
                  remaining > 0
                    ? 'text-app-danger dark:text-red-300'
                    : remaining < 0
                      ? 'text-app-success'
                      : 'text-app-ink dark:text-zinc-100',
                )}
              >
                {currencySymbol}{Math.abs(remaining).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" fullWidth disabled={isSubmitting} onClick={onBack}>Cancel</Button>
            {/*
              Disabled while a sale is in flight. The idempotency key already
              makes a repeat harmless, but stopping the second request at the
              button is what keeps a double-click from looking like a hang.
              Also disabled while the customer is short: the sale RPC requires the
              received amount to equal the total, so confirming a short payment
              could only ever come back as a server error.
            */}
            <Button
              type="button"
              variant="primary"
              fullWidth
              isLoading={isSubmitting}
              disabled={remaining > 0}
              onClick={onConfirm}
            >
              {isSubmitting ? 'Processing…' : posMode === 'retail' ? 'Confirm & Pay' : 'Create Order'}
            </Button>
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}
