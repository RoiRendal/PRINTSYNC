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
  onRemove,
  onOpenDesignSelector,
  onBack,
}: POSItemDetailsProps) {
  const design = item.designId ? designs.find((d) => d.id === item.designId) : undefined;
  const image = design?.imageUrl ?? item.imageUrl;
  const lineTotal = item.price * item.qty;
  const cataloguePrice = item.cataloguePrice ?? item.price;
  const isOverridden = cataloguePrice !== item.price;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex cursor-pointer items-center gap-1.5 self-start text-2xs font-bold text-app-text-muted hover:text-app-ink dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ChevronLeft className="h-3 w-3" aria-hidden="true" />
        Back to cart
      </button>

      <div className="flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border bg-[var(--app-state-hover)]">
        {image ? (
          <img src={image} alt={item.name} className="h-40 w-full object-contain" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center text-3xs text-app-text-muted dark:text-zinc-500">No image</div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-bold tracking-tight text-app-ink dark:text-zinc-100">{item.name}</h3>
        {design && (
          <p className="mt-1 text-2xs text-app-text-muted dark:text-zinc-400">Design · {design.name}</p>
        )}
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
          <span className="text-3xs font-bold text-app-text-muted dark:text-zinc-400">Rate ({currencySymbol})</span>
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
