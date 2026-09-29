import { CheckCircle2, ChevronLeft, Edit, Minus, Plus, RotateCw, Trash2 } from '../../../../shared/components/ui/icons';
import type { Design } from '../../../designs/types';
import type { CartItem } from '../../types';
import { Button, Input } from '../../../../shared/components/ui';

export interface POSItemDetailsProps {
  /** The line being inspected. Owned by `POSCart`. */
  item: CartItem;
  /** Its position in the cart — every mutation is addressed by index. */
  index: number;
  designs: Design[];
  posMode: 'retail' | 'custom';
  currencySymbol: string;
  onUpdateQty: (index: number, delta: number) => void;
  onSetLinePrice: (index: number, price: number) => void;
  onSetLineDiscount: (index: number, amount: number) => void;
  onRemove: (index: number) => void;
  onOpenDesignSelector: (index: number) => void;
  onBack: () => void;
}

/**
 * One cart line, on its own.
 *
 * ERPNext reaches this by tapping a row (`.item-details-container`), and the
 * point of the surface there is to give the row's less-frequent edits a place
 * with room: quantity, rate, and remove. This is the same idea with the same
 * three fields — quantity, **rate**, and remove.
 *
 * What is deliberately absent: a per-line **discount**. ERPNext has one, and the
 * plan called for it, but `order_items` has no discount column and the sale RPC
 * takes none, so a per-line discount could only ever live in the browser. It
 * would show on the receipt and vanish from the record the moment the order was
 * reopened — the cart would re-derive the total from lines that no longer carry
 * it. A control that silently loses money data is worse than no control, so it
 * is not here until the column exists.
 *
 * The row itself keeps its inline −/+ stepper. That is the one edit a cashier
 * makes constantly, and this screen is one click further away on purpose — it is
 * for the edits you make deliberately, not the ones you make forty times an hour.
 */
export function POSItemDetails({
  item,
  index,
  designs,
  posMode,
  currencySymbol,
  onUpdateQty,
  onSetLinePrice,
  onSetLineDiscount,
  onRemove,
  onOpenDesignSelector,
  onBack,
}: POSItemDetailsProps) {
  const design = item.designId ? designs.find((d) => d.id === item.designId) : undefined;
  const image = design?.imageUrl ?? item.imageUrl;
  const lineGross = item.price * item.qty;
  const lineDiscount = Math.min(item.lineDiscount ?? 0, lineGross);
  const lineTotal = lineGross - lineDiscount;
  const cataloguePrice = item.cataloguePrice ?? item.price;
  const isOverridden = cataloguePrice !== item.price;

  return (
    /*
     * `gap-3`, not `gap-4`, and a shorter image: this pane shares its height
     * with the cart footer, and at a 900px viewport the fields that matter —
     * rate and discount — were falling below the fold. The pane scrolls, so
     * nothing was unreachable, but a control you have to scroll to find on a
     * till is a control that gets missed.
     */
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex cursor-pointer items-center gap-1.5 self-start text-2xs font-bold text-app-text-muted hover:text-app-ink dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ChevronLeft className="h-3 w-3" aria-hidden="true" />
        Back to cart
      </button>

      {/*
        Image and name share a row rather than stacking. Stacked, the picture
        alone took a third of the pane and pushed the rate and discount fields
        below the fold — the pane scrolls, so nothing was unreachable, but a
        control you have to scroll to find is one that gets missed. Side by side
        it still identifies the line at a glance.
      */}
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-card)] border bg-[var(--app-state-hover)]">
          {image ? (
            <img src={image} alt={item.name} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xs text-app-text-muted dark:text-zinc-500">None</div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold tracking-tight text-app-ink dark:text-zinc-100">{item.name}</h3>
          {design && (
            <p className="mt-0.5 truncate text-2xs text-app-text-muted dark:text-zinc-400">Design · {design.name}</p>
          )}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-3xs font-bold text-app-text-muted dark:text-zinc-400">Quantity</span>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-full bg-[var(--app-state-hover)] dark:bg-[var(--app-tint-neutral)]">
            <button
              type="button"
              onClick={() => onUpdateQty(index, -1)}
              className="cursor-pointer p-2 hover:bg-[var(--app-state-hover-sub)]"
              aria-label={`Decrease ${item.name}`}
            >
              <Minus className="h-3 w-3" aria-hidden="true" />
            </button>
            <span className="w-10 select-none py-2 text-center tabular-nums text-xs">{item.qty}</span>
            <button
              type="button"
              onClick={() => onUpdateQty(index, 1)}
              className="cursor-pointer p-2 hover:bg-[var(--app-state-hover-sub)]"
              aria-label={`Increase ${item.name}`}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      </label>

      <div className="space-y-1.5">
        <label className="block space-y-1.5">
          {/*
            The unit rides on the rate, which is where ERPNext prints it too
            (`250.00 / Nos`). It is a property of the item, so it is read-only
            here — the till overrides the price, never the unit of measure.
          */}
          <span className="text-3xs font-bold text-app-text-muted dark:text-zinc-400">
            Rate ({currencySymbol} / {item.uom})
          </span>
          <Input
            type="number"
            min={0}
            step="0.01"
            fieldSize="sm"
            className="w-32 text-right tabular-nums text-xs"
            value={item.price}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onSetLinePrice(index, Number.isFinite(v) ? v : 0);
            }}
            aria-label={`Rate for ${item.name}`}
          />
        </label>
        {/*
          An override has to be visible, or a mistyped rate is unfindable and
          unfixable. The line says what the catalogue wanted and offers the way
          back; nothing is shown at all while the two agree.
        */}
        {isOverridden && (
          <div className="flex items-center gap-2">
            <span className="text-3xs text-app-text-muted dark:text-zinc-400">
              Catalogue {currencySymbol}{cataloguePrice.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => onSetLinePrice(index, cataloguePrice)}
              aria-label="Reset rate to catalogue"
              className="flex cursor-pointer items-center gap-1 text-3xs font-bold text-app-text-muted underline decoration-dotted underline-offset-2 hover:text-app-ink dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <RotateCw className="h-2.5 w-2.5" aria-hidden="true" />
              Reset
            </button>
          </div>
        )}
      </div>

      {/*
        The per-line discount. It could not exist before the column did — a
        discount held only in the browser would print on the receipt and vanish
        from the record the moment the order was reopened. The server now stores
        it, so the field is honest.
      */}
      <label className="block space-y-1.5">
        <span className="text-3xs font-bold text-app-text-muted dark:text-zinc-400">Discount ({currencySymbol})</span>
        <Input
          type="number"
          min={0}
          max={lineGross}
          step="0.01"
          fieldSize="sm"
          className="w-32 text-right tabular-nums text-xs"
          value={lineDiscount}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onSetLineDiscount(index, Number.isFinite(v) ? v : 0);
          }}
          aria-label={`Discount for ${item.name}`}
        />
        {lineGross > 0 && lineDiscount >= lineGross && (
          <span className="block text-3xs text-app-text-muted dark:text-zinc-400">
            Capped at the line value ({currencySymbol}{lineGross.toFixed(2)}).
          </span>
        )}
      </label>

      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-2xs font-bold text-app-text-muted dark:text-zinc-400">Line total</span>
        <span className="tabular-nums text-sm font-bold text-app-ink dark:text-zinc-100">
          {currencySymbol}{lineTotal.toFixed(2)}
        </span>
      </div>

      <div className="space-y-2">
        {posMode === 'custom' && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            fullWidth
            onClick={() => onOpenDesignSelector(index)}
            leftIcon={item.designId ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <Edit className="h-3 w-3" aria-hidden="true" />}
          >
            {item.designId ? 'Change Design' : 'Select Design'}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          fullWidth
          onClick={() => onRemove(index)}
          leftIcon={<Trash2 className="h-3 w-3" aria-hidden="true" />}
        >
          Remove from cart
        </Button>
      </div>
    </div>
  );
}
