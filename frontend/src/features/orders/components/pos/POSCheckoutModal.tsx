import { Banknote, CheckCircle2, CreditCard } from 'lucide-react';
import type { CartItem } from '../../types';
import type { CartTotals } from '../../hooks/useCartTotals';
import { Button, Modal } from '../../../../shared/components/ui';

interface POSCheckoutModalProps {
  isOpen: boolean;
  checkoutSuccess: boolean;
  posMode: 'retail' | 'custom';
  cart: CartItem[];
  totals: CartTotals;
  paymentMethod: 'Cash' | 'Card';
  onPaymentMethodChange: (method: 'Cash' | 'Card') => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function POSCheckoutModal({
  isOpen,
  checkoutSuccess,
  posMode,
  cart,
  totals,
  paymentMethod,
  onPaymentMethodChange,
  onConfirm,
  onClose,
}: POSCheckoutModalProps) {
  const { subtotal, discount: appliedDiscount, tax, total } = totals;

  return (
    <Modal isOpen={isOpen} onClose={() => !checkoutSuccess && onClose()} title="Process Checkout">
      <div className="space-y-6">
        {checkoutSuccess ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-macos-green/20 bg-macos-green/12 text-macos-green shadow-[var(--shadow-card)]">
              <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-macos-text dark:text-zinc-100">Transaction Successful</h4>
              <p className="text-xs text-macos-text-muted dark:text-zinc-400">Inventory updated and record saved.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-macos-text-muted dark:text-zinc-400">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Amount to Pay</span>
                <span className="font-mono text-xl font-bold text-macos-text dark:text-zinc-100">₱{total.toFixed(2)}</span>
              </div>
              <div className="space-y-1 border-b border-black/5 pb-3 font-mono text-[9px] text-macos-text-muted dark:border-white/10 dark:text-zinc-500">
                <div className="flex justify-between"><span>Subtotal</span><span>₱{subtotal.toFixed(2)}</span></div>
                {appliedDiscount > 0 && <div className="flex justify-between"><span>Discount</span><span>−₱{appliedDiscount.toFixed(2)}</span></div>}
                <div className="flex justify-between"><span>VAT ({totals.vatRatePercent}%)</span><span>₱{tax.toFixed(2)}</span></div>
              </div>
            </div>

            {posMode === 'retail' && (
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-400">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={paymentMethod === 'Cash' ? 'primary' : 'secondary'} onClick={() => onPaymentMethodChange('Cash')} leftIcon={<Banknote className="h-3.5 w-3.5" aria-hidden="true" />}>Cash</Button>
                  <Button type="button" variant={paymentMethod === 'Card' ? 'primary' : 'secondary'} onClick={() => onPaymentMethodChange('Card')} leftIcon={<CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}>Card</Button>
                </div>
              </div>
            )}

            <div className="max-h-40 space-y-2 overflow-y-auto border-t border-black/5 pt-4 pr-2 dark:border-white/10">
              {cart.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="flex justify-between text-[10px]">
                  <span className="font-medium uppercase text-macos-text-muted">{item.qty}x {item.name}</span>
                  <span className="font-mono text-macos-text dark:text-zinc-300">₱{(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
              <Button type="button" fullWidth onClick={onConfirm}>Confirm & Pay</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
