/**
 * The list toolbar's one shared measurement.
 *
 * The search box is literally the same field on every list table — `SearchInput`
 * has no size prop, so each one is `Input` at its `md` size (`h-7 text-sm`). What
 * differed was the *clamp* each page wrapped it in, and the spread was large
 * enough that the same control looked like five different ones:
 *
 *   stocks / designs   no clamp        → stretched to fill the card
 *   orders             md:max-w-xl     → 576px
 *   retail sales       md:max-w-2xl    → 672px
 *   customers / users  md:max-w-md     → 448px
 *   audit log          sm:max-w-xs     → 320px
 *   POS catalog        lg:w-56 xl:w-64 → 224–256px, fixed
 *
 * A search field is not a control that should resize itself to editorialise
 * about how much room its card happens to have. It is one control, so it gets
 * one width, and the toolbar's own controls sit to its right.
 *
 * Kept as a single exported constant rather than repeated literals so the next
 * table that is added cannot quietly pick its own — which is exactly how the
 * spread arose in the first place. `TOOLBAR_SEARCH_WIDTH_CLASS` is a Tailwind
 * class string, not a number, because it has to survive `cn()` merging.
 *
 * 20rem (320px) is the choice: wide enough to read a SKU, an order id or a
 * customer name without the field feeling cramped, and narrow enough that the
 * four icon squares beside it still fit on one row at every breakpoint.
 */
export const TOOLBAR_SEARCH_WIDTH_CLASS = 'w-full sm:w-80';

/**
 * The list toolbar row itself: full width, wrapping to a column below `sm` so
 * the search box keeps its width instead of being squeezed by the buttons.
 *
 * Every list surface already used this shape; it lives here so the surfaces
 * that had drifted (the audit log's `flex w-full gap-2`, which stacked search
 * over Refresh on mid-width screens because it never went back to a row at all)
 * are pulled onto the same one.
 */
export const TOOLBAR_ROW_CLASS =
  'flex w-full flex-col gap-2 sm:flex-row sm:items-center';
