import { Printer, X } from 'lucide-react';
import { Button, Modal } from '../../../../shared/components/ui';
import { useBusinessBranding } from '../../../../app/providers/BusinessBrandingProvider';
import type { CartItem } from '../../types';
import type { CartTotals } from '../../hooks/useCartTotals';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  posMode: 'retail' | 'custom';
  cart: CartItem[];
  totals: CartTotals;
  paymentMethod: 'Cash' | 'Card';
  customerName: string;
  orderId?: string;
}

export function ReceiptModal({ isOpen, onClose, posMode, cart, totals, paymentMethod, customerName, orderId }: ReceiptModalProps) {
  const { businessDisplayName, currencySymbol } = useBusinessBranding();
  const { subtotal, discount: appliedDiscount, tax, total } = totals;
  const now = new Date().toLocaleString();

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={posMode === 'retail' ? 'Receipt' : 'Order Summary'} maxWidth="max-w-md">
      <div className="space-y-5">
        <div id="receipt-content" className="space-y-4 rounded-[var(--radius-card)] border border-black/10 bg-white p-6 text-black shadow-sm dark:border-white/10 dark:bg-zinc-100 dark:text-zinc-900">
          <div className="text-center">
            <h3 className="text-sm font-bold uppercase tracking-widest">{businessDisplayName}</h3>
            <p className="mt-1 text-[10px] text-zinc-500">{now}</p>
          </div>

          <div className="border-b border-dashed border-black/20 pb-3 dark:border-zinc-400">
            {posMode === 'custom' && (
              <div className="mb-2 text-[10px]">
                <p><strong>Customer:</strong> {customerName || 'Walk-in'}</p>
                {orderId && <p><strong>Order Ref:</strong> {orderId}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              {cart.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="flex justify-between text-[10px]">
                  <span>{item.qty}x {item.name}</span>
                  <span className="font-mono">{currencySymbol}{(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{currencySymbol}{subtotal.toFixed(2)}</span></div>
            {appliedDiscount > 0 && <div className="flex justify-between"><span>Discount</span><span className="font-mono">−{currencySymbol}{appliedDiscount.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span>VAT ({totals.vatRatePercent}%)</span><span className="font-mono">{currencySymbol}{tax.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-dashed border-black/20 pt-1.5 text-sm font-bold dark:border-zinc-400">
              <span>{posMode === 'retail' ? 'TOTAL' : 'ORDER TOTAL'}</span>
              <span className="font-mono">{currencySymbol}{total.toFixed(2)}</span>
            </div>
          </div>

          {posMode === 'retail' && (
            <div className="text-center text-[10px]">
              <p className="font-bold uppercase">Paid via {paymentMethod}</p>
              <p className="mt-2 text-zinc-500">Thank you for your business!</p>
            </div>
          )}

          {posMode === 'custom' && (
            <div className="text-center text-[10px]">
              <p className="font-bold uppercase text-macos-purple">Custom Order — Balance may be due on pickup</p>
              <p className="mt-2 text-zinc-500">Please keep this summary for your records.</p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" fullWidth leftIcon={<X className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onClose}>
            Close
          </Button>
          <Button type="button" fullWidth leftIcon={<Printer className="h-3.5 w-3.5" aria-hidden="true" />} onClick={handlePrint}>
            Print
          </Button>
        </div>
      </div>
    </Modal>
  );
}
