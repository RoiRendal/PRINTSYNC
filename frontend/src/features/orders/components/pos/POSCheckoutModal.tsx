import { Banknote, CheckCircle2, CreditCard, Printer } from 'lucide-react';
import type { InsufficientStockDetails } from '@printsync/shared-types';
import type { CartItem } from '../../types';
import type { CartTotals } from '../../hooks/useCartTotals';
import { Button, Modal } from '../../../../shared/components/ui';
import { cn } from '../../../../shared/lib/cn';

/**
 * Why the last checkout attempt did not go through.
 *
 * `stock` is populated only for a short-stock rejection, which is the one
 * failure the cashier can act on without leaving the till — so the modal flags
 * the exact cart line instead of leaving them to guess which item is short.
 */
export interface CheckoutError {
  message: string;
  stock: InsufficientStockDetails | null;
}

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
  onPaymentMethodChange,
  onConfirm,
  onClose,
  onPrintReceipt,
}: POSCheckoutModalProps) {
  const { subtotal, discount: appliedDiscount, tax, total } = totals;

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
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-macos-green/20 bg-macos-green/12 text-macos-green shadow-[var(--shadow-card)]">
              <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-macos-text dark:text-zinc-100">
                {posMode === 'retail' ? 'Transaction Successful' : 'Order Created'}
              </h4>
              <p className="text-xs text-macos-text-muted dark:text-zinc-400">
                {posMode === 'retail' ? 'Inventory updated and record saved.' : 'Custom job entered into production pipeline.'}
              </p>
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
            {checkoutError && (
              <div
                role="alert"
                className="rounded-[var(--radius-card)] border border-macos-red/20 bg-macos-red/10 px-3 py-2 text-[10px] font-semibold leading-relaxed text-red-700 dark:border-macos-red/25 dark:bg-macos-red/15 dark:text-red-300"
              >
                {checkoutError.message}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between text-macos-text-muted dark:text-zinc-400">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Amount to Pay</span>
                <span className="font-mono text-xl font-bold text-macos-text dark:text-zinc-100">{currencySymbol}{total.toFixed(2)}</span>
              </div>
              <div className="space-y-1 border-b border-black/5 pb-3 font-mono text-[9px] text-macos-text-muted dark:border-white/10 dark:text-zinc-500">
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

            <div className="max-h-40 space-y-2 overflow-y-auto border-t border-black/5 pt-4 pr-2 dark:border-white/10">
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
