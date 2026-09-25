import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRowSelection } from './useRowSelection';

/*
 * The rules this hook has to hold, in the order they matter:
 *
 *   1. A bulk delete may only ever touch rows the user can see. The intersection
 *      with `selectableIds` is what enforces that, and it is the one property that
 *      makes the "X items selected" header label honest without counting rows
 *      on screen first.
 *   2. A row a caller withholds (an account that must not be deleted) is out of
 *      reach of both the row box and "select all", so the count in the header
 *      can never promise something the server will refuse.
 *   3. The header box reports three states, and unticking it clears everything.
 */

const THREE = ['a', 'b', 'c'];

describe('useRowSelection — ticking rows', () => {
  it('starts with nothing ticked', () => {
    const { result } = renderHook(() => useRowSelection(THREE));
    expect(result.current.count).toBe(0);
    expect(result.current.allSelected).toBe(false);
    expect(result.current.isIndeterminate).toBe(false);
  });

  it('toggles a single row on and off', () => {
    const { result } = renderHook(() => useRowSelection(THREE));

    act(() => result.current.toggle('b'));
    expect(result.current.count).toBe(1);
    expect(result.current.has('b')).toBe(true);

    act(() => result.current.toggle('b'));
    expect(result.current.count).toBe(0);
  });

  it('reports the third state once some, but not all, rows are ticked', () => {
    const { result } = renderHook(() => useRowSelection(THREE));

    act(() => result.current.toggle('a'));
    expect(result.current.isIndeterminate).toBe(true);
    expect(result.current.allSelected).toBe(false);

    act(() => result.current.toggle('b'));
    act(() => result.current.toggle('c'));
    expect(result.current.isIndeterminate).toBe(false);
    expect(result.current.allSelected).toBe(true);
  });
});

describe('useRowSelection — select all', () => {
  it('ticks every row on offer', () => {
    const { result } = renderHook(() => useRowSelection(THREE));

    act(() => result.current.toggleAll());
    expect(result.current.count).toBe(3);
    expect(result.current.allSelected).toBe(true);
  });

  it('clears everything when every row was already ticked', () => {
    const { result } = renderHook(() => useRowSelection(THREE));

    act(() => result.current.toggleAll());
    act(() => result.current.toggleAll());
    expect(result.current.count).toBe(0);
  });

  it('replaces a partial selection rather than adding to it', () => {
    const { result } = renderHook(() => useRowSelection(THREE));

    act(() => result.current.toggle('a'));
    act(() => result.current.toggleAll());

    expect(result.current.count).toBe(3);
    expect(result.current.allSelected).toBe(true);
  });

  it('offers nothing, and cannot be "all selected", when there are no rows', () => {
    const { result } = renderHook(() => useRowSelection([]));

    act(() => result.current.toggleAll());
    expect(result.current.count).toBe(0);
    expect(result.current.allSelected).toBe(false);
  });
});

describe('useRowSelection — the selection cannot outlive what is on screen', () => {
  it('drops a ticked row once the caller stops offering it', () => {
    // 'c' has left the filter (or the page) while ticked.
    const { result, rerender } = renderHook(({ ids }) => useRowSelection(ids), {
      initialProps: { ids: THREE },
    });

    act(() => result.current.toggle('c'));
    expect(result.current.count).toBe(1);

    rerender({ ids: ['a', 'b'] });
    // The point of the intersection: 'c' can no longer be deleted by accident,
    // so the count beside the delete button drops with it.
    expect(result.current.count).toBe(0);
    expect(result.current.selectedIds.has('c')).toBe(false);
  });

  it('keeps the ticks that are still on offer', () => {
    const { result, rerender } = renderHook(({ ids }) => useRowSelection(ids), {
      initialProps: { ids: THREE },
    });

    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('c'));

    rerender({ ids: ['a', 'b'] });
    expect(result.current.count).toBe(1);
    expect(result.current.has('a')).toBe(true);
  });

  it('never offers a withheld row to "select all"', () => {
    // 'protected' is left out of the list a caller passes — how the users table
    // withholds the signed-in admin's own account.
    const { result } = renderHook(() => useRowSelection(['staff-1', 'staff-2']));

    act(() => result.current.toggleAll());
    expect(result.current.count).toBe(2);
    expect(result.current.selectedIds.has('protected')).toBe(false);
  });
});
