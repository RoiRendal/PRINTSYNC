import { useState } from 'react';
import { AlertCircle, CheckCircle2, CreditCard, Edit, Minus, Plus, Trash2 } from '../../../../shared/components/ui/icons';
import type { Design } from '../../../designs/types';
import type { CartItem } from '../../types';
import type { CartTotals } from '../../hooks/useCartTotals';
import { Button, SurfaceCard, Input } from '../../../../shared/components/ui';
import { EmptyState } from '../../../../shared/components/feedback/EmptyState';
import { CustomerSelector } from '../../../customers/components/CustomerSelector';
import { POSItemDetails } from './POSItemDetails';
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
  onSetLinePrice: (index: number, price: number) => void;
  onSetLineDiscount: (index: number, amount: number) => void;
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
  onSetLinePrice,
  onSetLineDiscount,
  onRemoveFromCart,
  onOpenDesignSelector,
  onReset,
  onCheckout,
}: POSCartProps) {
  const { subtotal, discount: appliedDiscount, tax, total } = totals;
  /** Whether the discount field is open. Local, because it is a property of this
   *  panel's layout, not of the sale. */
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  /**
   * Which line is open in Item Details, if any.
   *
   * Owned here rather than by the page: it is a property of this panel's layout,
   * not of the sale. `cart[selectedLine]` is read defensively below, so a line
   * removed from under the view falls back to the list instead of rendering an
   * empty detail — the index is only ever a pointer into `cart`, and the cart
   * can change while the detail is open (the design modal, a background refresh
   * of the catalogue).
   */
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const detailItem = selectedLine !== null ? cart[selectedLine] : undefined;

  /*
   * Header and footer are `shrink-0`; only the list between them takes the
   * leftover height and scrolls. That is what keeps the totals and the action
   * row in the same place whether the cart holds one line or forty — a cashier
   * should not have to hunt for the button that finishes the sale.
   *
   * The footer no longer needs a `max-h` guess: below `xl` the panel keeps the
   * 60vh cap it always had, from `xl` up the grid gives it a real height and the
   * list answers to that instead.
   */
  return (
    <SurfaceCard className="flex w-full min-w-0 shrink-0 flex-col overflow-hidden p-0 xl:h-full xl:shrink">
      {/*
        The header names the panel and counts its lines, and that is all it does.
        "Checkout panel" restated the obvious — this is the column the checkout
        swaps into, and the heading already says which mode it is — so the line
        went, and the wrapper that existed only to stack it went with it.

        `px-4 pt-4` rather than `p-4`: the rule below is drawn by the inner div's
        own `pb-3`, so an outer bottom padding stacked 16px of dead space on top
        of the customer block's own 16px and pushed "Customer" half a line away
        from the heading it belongs under.

        No `label-caps`: the app's one uppercase treatment is reserved for group
        headers, and a panel title reads as a title — sentence case, `text-sm`,
        the same treatment `CardTitle` gives every other card heading. The count
        is a figure, so it is muted ink like every other figure, not a tinted pill.
      */}
      <div className="relative shrink-0 px-4 pt-4">
        <div className="relative flex items-center justify-between gap-3 border-b pb-3">
          <h2 className="text-sm font-bold tracking-tight text-app-ink dark:text-zinc-100">
            {posMode === 'retail' ? 'Item Cart' : editingOrderId ? 'Custom Order Update' : 'Custom Cart'}
          </h2>
          {/*
            `dark:text-zinc-400`, not the `-500` the footer labels use. The pill's
            tint used to carry the contrast; on the bare panel fill the same
            `zinc-500` measures 3.52:1 against `--app-surface`, under the 4.5:1
            floor for 10px type. `zinc-400` measures 6.49:1 and is the step the
            "· optional" hint beside it already uses.
          */}
          {/*
            "item(s)" rather than "items": the count reads the same whether there
            is one line or forty, so the label never flickers between singular and
            plural as the cashier adds and removes stock.
          */}
          <span className="text-2xs font-bold tabular-nums text-app-text-muted dark:text-zinc-400">{cart.length} item(s)</span>
        </div>
      </div>

      {/*
        The customer is the sale's header, not one of its lines — so it is its
        own box above the list and never scrolls. It used to sit inside the
        scrolling area, which meant the name of the person you are building the
        job for scrolled away with the items. ERPNext puts the customer in its
        own card at the top of the right column for the same reason: it is who
        the sale is FOR, and everything below it is what they are buying.

        The tint went with the move. The block used to be a rounded, filled
        panel floating inside the cart; a rule under it separates just as
        clearly, and a tint inside an already-bounded panel is a frame worn for
        the sake of wearing one (R19–R21).
      */}
      {/*
        The customer is the sale's header, not one of its lines — so it is its
        own box above the list and never scrolls. ERPNext puts it in its own card
        at the top of the right column for the same reason: it is who the sale is
        FOR, and everything below it is what they are buying.

        Shown in BOTH modes now. A retail sale can name a customer; it simply
        does not have to. The difference between the two modes is that a custom
        order *requires* a name and a counter sale does not — which is enforced
        at the button below, not by hiding the field.
      */}
      {/*
        `px-4 pb-4`, not `p-4`: the 16px top padding was the last of the dead
        space above the "Customer" label. The rule over the heading already
        separates the two blocks, so the customer block needs no padding of its
        own above its first line — removing it drops the gap heading→"Customer"
        by another 16px (74 → 38 → ~22 measured).
      */}
      <div className="shrink-0 space-y-3 border-b border-[var(--app-border-hairline)] px-4 pb-4">
        <label className="block space-y-1.5">
          <span className="text-3xs font-bold text-app-accent dark:text-app-accent-soft">
            Customer{posMode === 'retail' && <span className="font-medium text-app-text-muted dark:text-zinc-400"> · optional</span>}
          </span>
          <CustomerSelector
            customers={customers}
            customerId={customerId}
            customerName={customerName}
            onChange={(id, name) => { onCustomerIdChange(id); onCustomerNameChange(name); }}
          />
        </label>
        {posMode === 'custom' && (
          <label className="block space-y-1.5">
            <span className="text-3xs font-bold text-app-accent dark:text-app-accent-soft">Production Notes</span>
            <Input fieldSize="sm" className="text-xs" value={orderNotes} onChange={(e) => onOrderNotesChange(e.target.value)} aria-label="Production notes" />
          </label>
        )}
      </div>

      <div className="scrollbar-thin max-h-[60vh] space-y-2.5 overflow-y-auto px-4 pb-4 xl:max-h-none xl:min-h-0 xl:flex-1">
        {/*
          One occupant at a time inside a fixed span — the list and Item Details
          swap, they never stack. That is the mechanism ERPNext uses for its
          right column, and it is why the panel's geometry does not move when
          the cashier opens a line.
        */}
        {detailItem ? (
          <POSItemDetails
            item={detailItem}
            index={selectedLine as number}
            designs={designs}
            posMode={posMode}
            currencySymbol={currencySymbol}
            onUpdateQty={onUpdateQty}
            onSetLinePrice={onSetLinePrice}
            onSetLineDiscount={onSetLineDiscount}
            onRemove={(idx) => { onRemoveFromCart(idx); setSelectedLine(null); }}
            onOpenDesignSelector={onOpenDesignSelector}
            onBack={() => setSelectedLine(null)}
          />
        ) : cart.length === 0 ? (
          /*
           * One sentence, no glyph. The old pair of lines told the cashier what
           * to do and what the two modes are; the toolbar above already carries
           * Retail / Custom, and the totals below already read zero. A picture
           * of an empty tray said nothing the sentence does not.
           */
          <EmptyState title="No items in cart." icon={null} className="py-10" />
        ) : (
          cart.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="rounded-[var(--radius-card)] border p-2.5">
              <div className="flex gap-3">
                <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--app-surface)] dark:bg-[var(--app-tint-gray)]">
                  {item.designId ? (
                    <img src={designs.find(d => d.id === item.designId)?.imageUrl} alt="Selected design" className="h-full w-full object-cover" />
                  ) : item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    {/*
                      The name is the way into Item Details. It is a real button
                      rather than a click handler on the row because the row also
                      contains a stepper and a trash control, and a button cannot
                      contain buttons — wrapping the whole row would nest them.
                      The stepper stays inline: bumping a quantity is the edit a
                      cashier makes constantly, and sending it through a second
                      screen to save one click would be a regression.
                    */}
                    <button
                      type="button"
                      onClick={() => setSelectedLine(idx)}
                      title={`Edit ${item.name}`}
                      className="cursor-pointer truncate text-left text-2xs font-bold leading-tight text-app-ink hover:underline hover:decoration-dotted hover:underline-offset-2 dark:text-zinc-100"
                    >
                      {item.name}
                    </button>
                    <button type="button" onClick={() => onRemoveFromCart(idx)} className="cursor-pointer text-app-text-muted hover:text-app-danger dark:text-zinc-500 dark:hover:text-red-300" aria-label={`Remove ${item.name}`}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <div className="flex overflow-hidden rounded-full bg-[var(--app-state-hover)] dark:bg-[var(--app-tint-neutral)]">
                      <button type="button" onClick={() => onUpdateQty(idx, -1)} className="cursor-pointer p-1.5 hover:bg-[var(--app-state-hover)]" aria-label={`Decrease ${item.name}`}><Minus className="h-2.5 w-2.5" aria-hidden="true" /></button>
                      <span className="w-7 select-none py-1.5 text-center tabular-nums text-2xs">{item.qty}</span>
                      <button type="button" onClick={() => onUpdateQty(idx, 1)} className="cursor-pointer p-1.5 hover:bg-[var(--app-state-hover)]" aria-label={`Increase ${item.name}`}><Plus className="h-2.5 w-2.5" aria-hidden="true" /></button>
                    </div>
                    <span className="tabular-nums text-2xs font-bold text-app-ink dark:text-zinc-100">
                      {currencySymbol}{(item.price * item.qty - Math.min(item.lineDiscount ?? 0, item.price * item.qty)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              {posMode === 'custom' && (
                <div className="mt-2 flex gap-2 border-t pt-2">
                  {/*
                    This button's fill used to BE the status readout — dark once a
                    design was attached, grey before that. That is the inversion
                    the whole round is about: a button's fill says "press me",
                    not "this line is done", and spending the darkest value on a
                    per-row state left nothing for the one real action below.

                    The state is still legible without it, and in words rather
                    than in colour: the label swaps Select/Change Design, the
                    glyph swaps Edit/CheckCircle2, and the chip beside it names
                    the design that is set. No cue was dropped, only recoloured.
                  */}
                  <Button type="button" variant="secondary" size="sm" fullWidth onClick={() => onOpenDesignSelector(idx)} leftIcon={item.designId ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <Edit className="h-3 w-3" aria-hidden="true" />}>
                    {item.designId ? 'Change Design' : 'Select Design'}
                  </Button>
                  {item.designId && <div className="max-w-[100px] truncate rounded-full bg-[var(--app-state-hover)] px-2 py-2 text-3xs dark:bg-[var(--app-tint-neutral)]">{designs.find(d => d.id === item.designId)?.name}</div>}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t p-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-2xs tabular-nums text-app-text-muted dark:text-zinc-500"><span className="font-bold">Subtotal</span><span className="text-app-ink dark:text-zinc-300">{currencySymbol}{subtotal.toFixed(2)}</span></div>
          {/*
            Shown only when there is one, and read-only: a line discount is set
            on its own line in Item Details. Listing the sum here is what stops
            the footer's "Discount" field from reading as the whole story — the
            grand discount is this figure PLUS whatever is typed below, which is
            also what the sale RPC is sent and checks.
          */}
          {totals.lineDiscounts > 0 && (
            <div className="flex justify-between text-2xs tabular-nums text-app-text-muted dark:text-zinc-500">
              <span className="font-bold">Line discounts</span>
              <span className="text-app-ink dark:text-zinc-300">{currencySymbol}{totals.lineDiscounts.toFixed(2)}</span>
            </div>
          )}
          {/*
            ERPNext's `add-discount-wrapper`: the discount is a dashed button
            until someone asks for one. Most sales have no discount, so a
            permanently visible numeric field spends footer height — the height
            the pinned totals need — on a control that is usually zero.

            Once a discount exists the field stays open, so the number you typed
            remains visible and editable; setting it back to 0 collapses it to
            the button again.
          */}
          {isEditingDiscount || cartDiscount > 0 ? (
            <div className="flex items-center justify-between gap-2 text-2xs tabular-nums text-app-text-muted dark:text-zinc-500">
              <span className="shrink-0 font-bold">Discount ({currencySymbol})</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                fieldSize="sm"
                autoFocus
                className="w-24 max-w-[40%] px-2 text-right tabular-nums text-2xs"
                value={cartDiscount}
                onChange={(e) => { const v = parseFloat(e.target.value); onCartDiscountChange(Number.isFinite(v) ? Math.max(0, v) : 0); }}
                onBlur={() => setIsEditingDiscount(false)}
                aria-label="Cart discount"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingDiscount(true)}
              className="w-full rounded-[var(--radius-button)] border border-dashed border-[var(--app-border-control)] py-1.5 text-2xs font-bold text-app-text-muted hover:border-[var(--app-border-frame)] hover:text-app-ink dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Add Discount
            </button>
          )}
          {appliedDiscount > 0 && <div className="flex justify-between text-2xs tabular-nums text-app-text-muted dark:text-zinc-500"><span className="font-bold">After discount</span><span className="text-app-ink dark:text-zinc-300">{currencySymbol}{totals.afterDiscount.toFixed(2)}</span></div>}
          <div className="flex items-center justify-between gap-2 text-2xs tabular-nums text-app-text-muted dark:text-zinc-500">
            <span className="shrink-0 font-bold">VAT rate (%)</span>
            <Input type="number" min={0} step="0.01" fieldSize="sm" className="w-20 px-2 text-right tabular-nums text-2xs" value={vatRatePercent} onChange={(e) => { const v = parseFloat(e.target.value); onVatRatePercentChange(Number.isFinite(v) ? Math.max(0, v) : 0); }} aria-label="VAT rate" />
          </div>
          <div className="flex justify-between text-2xs tabular-nums text-app-text-muted dark:text-zinc-500"><span className="font-bold">VAT ({totals.vatRatePercent}%)</span><span className="text-app-ink dark:text-zinc-300">{currencySymbol}{tax.toFixed(2)}</span></div>
          {/*
            R25, applied to the till: a figure is never coloured. This Total used
            to be `text-app-accent` in custom mode, which made the amount the
            one accented thing on a screen whose accent is supposed to mean
            "press me". The label already says what kind of total it is.
          */}
          <div className="mt-2 flex justify-between border-t pt-3 text-xl font-bold tracking-tight text-app-ink dark:text-zinc-100">
            <span>{posMode === 'retail' ? 'Total' : 'Order value'}</span>
            <span className="tabular-nums">{currencySymbol}{total.toFixed(2)}</span>
          </div>
        </div>

        {posMode === 'custom' && editingOrderId && <div className="text-center text-3xs font-bold text-app-accent dark:text-app-accent-soft">Editing Order: {editingOrderId}</div>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={onReset}>Reset</Button>
          <Button type="button" variant="primary" onClick={onCheckout} disabled={cart.length === 0 || (posMode === 'custom' && !customerName)} leftIcon={<CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}>
            {posMode === 'retail' ? 'Quick Pay' : editingOrderId ? 'Update Order' : 'Create Order'}
          </Button>
        </div>
        {posMode === 'custom' && !customerName && cart.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 text-3xs font-bold text-app-warning">
            <AlertCircle className="h-2.5 w-2.5" aria-hidden="true" /> Client Name Required
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
