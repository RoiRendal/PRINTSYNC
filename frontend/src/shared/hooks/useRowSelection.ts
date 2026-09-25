import { useCallback, useMemo, useState } from 'react';

/**
 * What a bulk action needs to know about the ticks in a table.
 *
 * Deliberately a plain object rather than a hook per table: the page owns the
 * selection (it has to, to render the header control) and hands the whole thing
 * to the table component as one prop.
 */
export interface RowSelection {
  /**
   * The ids that are ticked **and** currently selectable. This — never the raw
   * tick set — is what a bulk delete may act on, so a row that has left the
   * filter or moved to another page can never be deleted unseen.
   */
  selectedIds: ReadonlySet<string>;
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
  /** Every selectable row is ticked. False when there is nothing to tick. */
  allSelected: boolean;
  /** Some are ticked, but not all — the header box's third state. */
  isIndeterminate: boolean;
}

const NONE: ReadonlySet<string> = new Set<string>();

/**
 * Tick state for one table's rows.
 *
 * ### Why the selection is scoped to what is on screen
 *
 * The header box means "all of these", and the "X items selected" label in
 * the header reads against the same list. If a tick could outlive the row's
 * visibility, the label would say "3 items selected" while two of those rows
 * sat on a page the user is not looking at — a bulk delete whose target set
 * cannot be seen is exactly the accident this design is supposed to prevent.
 * So `selectedIds` is the intersection of the ticks with the rows the caller
 * declares selectable.
 *
 * `selectableIds` is also how a caller withholds a row: an account that must not
 * be deleted is simply left out of the list, and it is then excluded from
 * "select all" and from the count without the table needing a special case.
 *
 * ### Why the memo keys on a string
 *
 * Callers build `selectableIds` with a `.map` over their filtered list, so its
 * array identity changes on every render and is useless as a dependency. The
 * joined string is the array's contents, which is the only thing this reads.
 */
export function useRowSelection(selectableIds: readonly string[]): RowSelection {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(NONE);

  const idKey = selectableIds.join('\u0000');

  const selectedIds = useMemo(() => {
    if (ticked.size === 0) return NONE;
    const selectable = new Set(selectableIds);
    const kept = new Set<string>();
    for (const id of ticked) {
      if (selectable.has(id)) kept.add(id);
    }
    return kept;
    // `idKey` stands in for `selectableIds`: same contents, stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticked, idKey]);

  const toggle = useCallback((id: string) => {
    setTicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setTicked(NONE), []);

  const toggleAll = useCallback(() => {
    setTicked((previous) => {
      const everyTicked = selectableIds.length > 0 && selectableIds.every((id) => previous.has(id));
      /*
       * Unticking the header clears everything, not just this page — that is what
       * the box says it does. Ticking it replaces the selection with exactly the
       * rows on offer, so the ticks always match the count beside the button.
       */
      return everyTicked ? NONE : new Set(selectableIds);
    });
    // `idKey` stands in for `selectableIds`: same contents, stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  const count = selectedIds.size;

  return {
    selectedIds,
    count,
    has: (id: string) => selectedIds.has(id),
    toggle,
    toggleAll,
    clear,
    allSelected: selectableIds.length > 0 && count === selectableIds.length,
    isIndeterminate: count > 0 && count < selectableIds.length,
  };
}
