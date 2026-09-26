import { AlertCircle, CheckCircle2, CreditCard, Edit, FileText, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import type { Design } from '../../../designs/types';
import type { CartItem } from '../../types';
import type { CartTotals } from '../../hooks/useCartTotals';
import { Badge, Button, SurfaceCard, Input } from '../../../../shared/components/ui';
import { EmptyState } from '../../../../shared/components/feedback/EmptyState';
import { cn } from '../../../../shared/lib/cn';
import { CustomerSelector } from '../../../customers/components/CustomerSelector';
import type { Customer } from '../../../customers/types';

interface POSCartProps {
  cart: CartItem[];
  designs: Design[];
  posMode: 'retail' | 'custom';
  editingOrderId: string | null;
  customers: Customer[];
  customerId: string | null;
  customerName: string;
  orderNotes: string;
  cartDiscount: number;
  vatRatePercent: number;
  totals: CartTotals;
  currencySymbol: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerIdChange: (id: string | null) => void;
  onOrderNotesChange: (value: string) => void;
  onCartDiscountChange: (value: number) => void;
  onVatRatePercentChange: (value: number) => void;
  onUpdateQty: (index: number, delta: number) => void;
  onRemoveFromCart: (index: number) => void;
  onOpenDesignSelector: (index: number) => void;
  onReset: () => void;
  onCheckout: () => void;
}

export function POSCart({
  cart,
  designs,
  posMode,
  editingOrderId,
  customers,
  customerId,
  customerName,
  orderNotes,
  cartDiscount,
  vatRatePercent,
  totals,
  currencySymbol,
  onCustomerNameChange,
  onCustomerIdChange,
  onOrderNotesChange,
  onCartDiscountChange,
  onVatRatePercentChange,
  onUpdateQty,
  onRemoveFromCart,
  onOpenDesignSelector,
  onReset,
  onCheckout,
}: POSCartProps) {
  const { subtotal, discount: appliedDiscount, tax, total } = totals;

  return (
    <SurfaceCard className="flex w-full flex-col overflow-hidden p-0 xl:sticky xl:top-4 xl:w-[23rem] xl:self-start">
      <div className="relative p-4">
        <div className="pointer-events-none absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 p-8 opacity-[0.04]">
          <ShoppingBag className="h-48 w-48" aria-hidden="true" />
        </div>
        <div className="relative flex items-center justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="label-caps text-macos-text dark:text-zinc-100">
              {posMode === 'retail' ? 'Transaction Cart' : editingOrderId ? 'Custom Order Update' : 'Custom Order Builder'}
            </h2>
            <p className="mt-1 text-xs text-macos-text-muted dark:text-zinc-500">Checkout panel</p>
          </div>
          <Badge variant={posMode === 'retail' ? 'blue' : 'purple'}>{cart.length} items</Badge>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-4 pb-4 space-y-2.5 scrollbar-hide">
        {posMode === 'custom' && (
          <div className="mb-4 space-y-3 rounded-[var(--radius-card)] border bg-[var(--app-tint-purple)] p-3">
            <label className="block space-y-1.5">
              <span className="text-3xs font-bold text-purple-700 dark:text-purple-300">Customer</span>
              <CustomerSelector
                customers={customers}
                customerId={customerId}
                customerName={customerName}
                onChange={(id, name) => { onCustomerIdChange(id); onCustomerNameChange(name); }}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-3xs font-bold text-purple-700 dark:text-purple-300">Production Notes</span>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-purple" aria-hidden="true" />
                <Input fieldSize="sm" className="pl-8 text-xs" value={orderNotes} onChange={(e) => onOrderNotesChange(e.target.value)} aria-label="Production notes" />
              </div>
            </label>
          </div>
        )}

        {cart.length === 0 ? (
          <EmptyState title="Build list to proceed" message="Select catalog items to stage a retail sale or custom order." className="py-10" />
        ) : (
          cart.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="rounded-[var(--radius-card)] border p-2.5">
              <div className="flex gap-3">
                <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-[0.75rem] bg-[#f5f5f5] dark:bg-[#3d3d3f]">
                  {item.designId ? (
                    <img src={designs.find(d => d.id === item.designId)?.imageUrl} alt="Selected design" className="h-full w-full object-cover" />
                  ) : item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-2xs font-bold leading-tight text-macos-text dark:text-zinc-100">{item.name}</span>
                    <button type="button" onClick={() => onRemoveFromCart(idx)} className="cursor-pointer text-macos-text-muted hover:text-macos-red dark:text-zinc-500 dark:hover:text-red-300" aria-label={`Remove ${item.name}`}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <div className="flex overflow-hidden rounded-full bg-[#f2f2f2] dark:bg-[#414143]">
                      <button type="button" onClick={() => onUpdateQty(idx, -1)} className="cursor-pointer p-1.5 hover:bg-[var(--app-state-hover)]" aria-label={`Decrease ${item.name}`}><Minus className="h-2.5 w-2.5" aria-hidden="true" /></button>
                      <span className="w-7 select-none py-1.5 text-center font-mono text-2xs">{item.qty}</span>
                      <button type="button" onClick={() => onUpdateQty(idx, 1)} className="cursor-pointer p-1.5 hover:bg-[var(--app-state-hover)]" aria-label={`Increase ${item.name}`}><Plus className="h-2.5 w-2.5" aria-hidden="true" /></button>
                    </div>
                    <span className="font-mono text-2xs font-bold text-macos-text dark:text-zinc-100">{currencySymbol}{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              {posMode === 'custom' && (
                <div className="mt-2 flex gap-2 border-t pt-2">
                  <Button type="button" variant={item.designId ? 'primary' : 'secondary'} size="sm" fullWidth onClick={() => onOpenDesignSelector(idx)} leftIcon={item.designId ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <Edit className="h-3 w-3" aria-hidden="true" />}>
                    {item.designId ? 'Change Design' : 'Select Design'}
                  </Button>
                  {item.designId && <div className="max-w-[100px] truncate rounded-full bg-[#f2f2f2] px-2 py-2 text-3xs dark:bg-[#414143]">{designs.find(d => d.id === item.designId)?.name}</div>}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 border-t p-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-2xs font-mono text-macos-text-muted dark:text-zinc-500"><span className="font-bold">Subtotal</span><span className="text-macos-text dark:text-zinc-300">{currencySymbol}{subtotal.toFixed(2)}</span></div>
          <div className="flex items-center justify-between gap-2 text-2xs font-mono text-macos-text-muted dark:text-zinc-500">
            <span className="shrink-0 font-bold">Discount ({currencySymbol})</span>
            <Input type="number" min={0} step="0.01" fieldSize="sm" className="w-24 max-w-[40%] px-2 text-right font-mono text-2xs" value={cartDiscount} onChange={(e) => { const v = parseFloat(e.target.value); onCartDiscountChange(Number.isFinite(v) ? Math.max(0, v) : 0); }} aria-label="Cart discount" />
          </div>
          {appliedDiscount > 0 && <div className="flex justify-between text-2xs font-mono text-macos-text-muted dark:text-zinc-500"><span className="font-bold">After discount</span><span className="text-macos-text dark:text-zinc-300">{currencySymbol}{totals.afterDiscount.toFixed(2)}</span></div>}
          <div className="flex items-center justify-between gap-2 text-2xs font-mono text-macos-text-muted dark:text-zinc-500">
            <span className="shrink-0 font-bold">VAT rate (%)</span>
            <Input type="number" min={0} step="0.01" fieldSize="sm" className="w-20 px-2 text-right font-mono text-2xs" value={vatRatePercent} onChange={(e) => { const v = parseFloat(e.target.value); onVatRatePercentChange(Number.isFinite(v) ? Math.max(0, v) : 0); }} aria-label="VAT rate" />
          </div>
          <div className="flex justify-between text-2xs font-mono text-macos-text-muted dark:text-zinc-500"><span className="font-bold">VAT ({totals.vatRatePercent}%)</span><span className="text-macos-text dark:text-zinc-300">{currencySymbol}{tax.toFixed(2)}</span></div>
          <div className="mt-2 flex justify-between border-t pt-3 text-xl font-bold tracking-tight text-macos-text dark:text-zinc-100">
            <span>{posMode === 'retail' ? 'Total' : 'Order value'}</span>
            <span className={cn('font-mono', posMode === 'retail' ? 'text-macos-text dark:text-zinc-100' : 'text-macos-purple dark:text-purple-300')}>{currencySymbol}{total.toFixed(2)}</span>
          </div>
        </div>

        {posMode === 'custom' && editingOrderId && <div className="text-center text-3xs font-bold text-macos-purple dark:text-purple-300">Editing Order: {editingOrderId}</div>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={onReset}>Reset</Button>
          <Button type="button" onClick={onCheckout} disabled={cart.length === 0 || (posMode === 'custom' && !customerName)} leftIcon={<CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}>
            {posMode === 'retail' ? 'Quick Pay' : editingOrderId ? 'Update Order' : 'Create Order'}
          </Button>
        </div>
        {posMode === 'custom' && !customerName && cart.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 text-3xs font-bold text-macos-orange">
            <AlertCircle className="h-2.5 w-2.5" aria-hidden="true" /> Client Name Required
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
