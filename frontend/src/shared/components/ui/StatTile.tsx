import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SurfaceCard } from './Card';

/**
 * A stat tile: a caps label over one figure, and nothing else.
 *
 * This is the app's single number card, and it exists because there were seven.
 * Before this component, `DashboardPage` grew its own tile at 30px with a unit
 * word and a sentence under it, `OrderSummaryCards` put its label on the left and
 * its figure on the right, `InventoryStats` and the analytics `MetricTile`
 * coloured the figure, and Customers, Users and Audit each carried the same
 * twelve lines copy-pasted. Same job, seven shapes — and all seven are now
 * this file, so there is nothing left to point at beside it.
 *
 * The target is ERPNext's number card, measured off the live demo's own compiled
 * stylesheet rather than read off a screenshot:
 *
 *   box     1px hairline, `min-height: 84px`, flat at rest
 *   label   11px / 500 / uppercase / muted
 *   figure  20px / 600, always body ink
 *   delta   12px, optional, and the only place a colour appears
 *
 * Three of those four are reproduced here directly. The fourth is not, and the
 * omission is deliberate: ERPNext can show a period-over-period delta because its
 * `Number Card` is a doctype that computes one server-side. Nothing in PrintSync
 * produces that comparison for orders or stock, and a tile must not render a
 * number nobody can stand behind — the same reason the Workspace carries no
 * revenue figure and the orders summary has no fallback. Build the slot when
 * there is a backend to fill it.
 *
 * ### What is deliberately absent
 *
 * - **No colour on the figure.** ERPNext never tints a number, so neither does
 *   this. Where a figure needs to say something — low stock above zero — the
 *   tile's destination says it, and `StatusLabel` / `Badge` exist for the rest.
 * - **No icon.** A glyph beside a label that already names the thing is
 *   ornament; R19–R22 removed it everywhere else.
 * - **No `tone` or `variant` prop.** A prop that offers a colour is a colour
 *   waiting to be used. If a tile ever needs one, that is a decision to make
 *   explicitly, not an option that was already there.
 * - **No unit word and no description line.** Both folded into the label, which
 *   is why the label is documented as a noun phrase.
 *
 * ### The box carries no fill
 *
 * `SurfaceCard` maps to `.surface-panel`: a 1px `--app-border-hairline` outline
 * and no background. ERPNext's card is white on a grey page and ours is an
 * outline on `--app-surface`; both read as "box on grey", and filling this one
 * would put back the shade ladder the flat-UI rounds deleted.
 */
export interface StatTileProps {
  /**
   * The label, written as a noun phrase — "Pending orders", "Low stock items".
   *
   * It renders in `.label-caps`, the app's one uppercase treatment (`index.css`,
   * 11px / 600 / 0.09em), which is also the house equivalent of ERPNext's
   * `.widget-title`. Anything the tile used to say with a separate unit word or
   * a sentence underneath now belongs in this string.
   */
  label: string;
  /**
   * The figure. Pass it already formatted — money and counts are formatted where
   * they are computed, and `tabular-nums` keeps the digits from jittering as the
   * number changes.
   */
  value: string | number;
  /**
   * When given, the whole tile becomes a link to this route.
   *
   * ERPNext puts `cursor: pointer` on the card itself: the count and the list
   * behind it are one thing, so the tile *is* the way to that list rather than a
   * box with a link in it. The focus ring lives here too, so every linked tile
   * in the app gets the same one.
   */
  to?: string;
}

export function StatTile({ label, value, to }: StatTileProps) {
  const card = (
    <SurfaceCard className="h-full p-4">
      {/*
        `text-app-text-muted` is theme-aware on its own — `--color-app-text-muted`
        is redefined under `.dark` — so it takes no `dark:` partner. All six
        hand-rolled tiles paired it with `dark:text-zinc-500`, which measures
        **3.52:1** on the dark page: below the 4.5:1 floor. Alone it is 6.82:1
        light and 6.64:1 dark, which is where ERPNext's own label sits too.
      */}
      <p className="label-caps text-app-text-muted">{label}</p>
      <p className="mt-2 tabular-nums text-xl font-bold tracking-tight text-app-ink dark:text-zinc-100">
        {value}
      </p>
    </SurfaceCard>
  );

  if (!to) return card;

  return (
    <Link
      to={to}
      className="block h-full rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
    >
      {card}
    </Link>
  );
}

/*
  The grid a row of tiles sits in.

  **Every class below must stay a literal string.** Tailwind reads source text,
  so a class assembled at runtime — `md:grid-cols-${columns}` — is invisible to
  the scanner and is never emitted: the row silently renders as one stacked
  column, and it looks like a layout bug rather than a class-name bug. This is
  the same trap that produced the sidebar's `min-w-[176px]`.

  That is also why the row ships alongside the tile. The column count was the
  other half of "these pages look different" — `md:grid-cols-3` on four pages,
  `grid-cols-2 md:grid-cols-4` on Orders, `xl:grid-cols-5` on the Workspace — so
  it needs one home as much as the tile does. The gap is fixed at `gap-3` for
  every row for the same reason.
*/
const ROW_COLUMNS = {
  1: 'grid grid-cols-1 gap-3',
  2: 'grid grid-cols-2 gap-3',
  3: 'grid grid-cols-1 gap-3 md:grid-cols-3',
  4: 'grid grid-cols-2 gap-3 lg:grid-cols-4',
  5: 'grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5',
} as const;

export interface StatTileRowProps {
  /** How many tiles the row holds at its widest. */
  columns: keyof typeof ROW_COLUMNS;
  children: ReactNode;
}

export function StatTileRow({ columns, children }: StatTileRowProps) {
  return <div className={ROW_COLUMNS[columns]}>{children}</div>;
}
