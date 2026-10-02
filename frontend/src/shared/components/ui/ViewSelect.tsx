import { DropdownMenu } from './DropdownMenu';
import type { DropdownOption } from './DropdownMenu';

/**
 * The two shapes a list surface can be drawn in.
 *
 * One name for both surfaces on purpose: the stock list and the design
 * repository offer the same pair, and a third surface should not be able to
 * invent a third name for "the table".
 */
export type ViewShape = 'list' | 'image';

/**
 * The vocabulary, in the order the menu shows it.
 *
 * `list` first because it is the ordinary reading order — a table before a
 * gallery — regardless of which one any given surface defaults to. The default
 * is the caller's business, not the menu's.
 */
const VIEW_OPTIONS: readonly DropdownOption<ViewShape>[] = [
  { value: 'list', label: 'List View' },
  { value: 'image', label: 'Image View' },
];

/**
 * Read a view out of the URL, or fall back.
 *
 * Both surfaces persist their choice with `useUrlFilter` and both have to deal
 * with the same three cases — a valid value, an absent param, and a stale
 * bookmark carrying something that was never a view. Keeping that in one place
 * means a bad value can only ever fall back the one way, rather than each
 * surface inventing its own behaviour for it.
 */
export function parseViewShape(raw: string | null | undefined, fallback: ViewShape): ViewShape {
  return raw === 'list' || raw === 'image' ? raw : fallback;
}

export interface ViewSelectProps {
  value: ViewShape;
  onChange: (value: ViewShape) => void;
  /** e.g. "Stock view" — what is being chosen, not what is chosen. */
  ariaLabel: string;
  className?: string;
}

/**
 * The view picker — ERPNext's `ListViewSelect`, in PrintSync's terms.
 *
 * The trigger shows the CURRENT shape as words plus a chevron; the menu lists
 * both and marks the chosen one. There is deliberately **no icon in the
 * trigger**: ERPNext pairs a glyph with the label, but PrintSync's rule is that
 * a glyph beside a visible label saying the same thing is decoration, and this
 * app removes those. The chevron stays because it is not decoration — it is the
 * only thing marking this as a control that opens.
 *
 * Which shape is the default is the caller's decision, not this component's:
 * the stock list defaults to the table, the design repository to the grid.
 */
export function ViewSelect({ value, onChange, ariaLabel, className }: ViewSelectProps) {
  return (
    <DropdownMenu
      value={value}
      options={VIEW_OPTIONS}
      onChange={onChange}
      ariaLabel={ariaLabel}
      className={className}
    />
  );
}
