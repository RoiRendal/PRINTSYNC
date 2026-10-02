import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventoryImageGrid, stockInitials } from './InventoryImageGrid';
import type { InventoryItem } from '../types';
import type { RowSelection } from '../../../shared/hooks/useRowSelection';

/*
 * The stock gallery's contract.
 *
 * The card is the target — clicking it opens the edit form — and the checkbox
 * sits INSIDE that target. That nesting is the whole risk this file guards: a
 * check box that does not stop propagation opens the edit modal every time
 * somebody ticks a card, which is the kind of bug that only shows up once staff
 * are ticking boxes in a hurry.
 */

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'i1',
    sku: 'SKU-001',
    name: 'Bond Paper',
    category: 'Paper',
    stock: 25,
    reorderLevel: 10,
    price: 250,
    costPrice: 200,
    uom: 'ream',
    imageUrl: null,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
    ...overrides,
  };
}

/** A selection stub — the real hook's behaviour is covered by its own test. */
function selection(overrides: Partial<RowSelection> = {}): RowSelection {
  return {
    selectedIds: new Set<string>(),
    count: 0,
    has: () => false,
    toggle: vi.fn(),
    toggleAll: vi.fn(),
    clear: vi.fn(),
    allSelected: false,
    isIndeterminate: false,
    ...overrides,
  };
}

function renderGrid(props: Partial<React.ComponentProps<typeof InventoryImageGrid>> = {}) {
  const handlers = {
    onSearchTermChange: vi.fn(),
    onRefresh: vi.fn(),
    onAddItem: vi.fn(),
    onEditItem: vi.fn(),
    onDeleteSelected: vi.fn(),
  };
  const result = render(
    <InventoryImageGrid
      items={[item()]}
      searchTerm=""
      selection={selection()}
      view="image"
      onViewChange={vi.fn()}
      {...handlers}
      {...props}
    />,
  );
  return { ...result, handlers };
}

describe('stockInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(stockInitials('Bond Paper')).toBe('BP');
    expect(stockInitials('A4 Glossy Photo Paper')).toBe('AG');
  });

  it('handles a single word', () => {
    expect(stockInitials('Ink')).toBe('I');
  });

  it('returns nothing for a name with no usable characters', () => {
    expect(stockInitials('   ')).toBe('');
  });
});

describe('InventoryImageGrid', () => {
  it('shows the item name, SKU, stock and price', () => {
    renderGrid();
    expect(screen.getByText('Bond Paper')).toBeInTheDocument();
    expect(screen.getByText('SKU-001')).toBeInTheDocument();
    expect(screen.getByText(/25 in stock/)).toBeInTheDocument();
    expect(screen.getByText('₱250.00')).toBeInTheDocument();
  });

  it('marks a low-stock figure in the app danger colour', () => {
    renderGrid({ items: [item({ stock: 3, reorderLevel: 10 })] });
    expect(screen.getByText(/3 in stock/).className).toContain('text-app-danger');
  });

  it('leaves a healthy figure in ink', () => {
    renderGrid({ items: [item({ stock: 25, reorderLevel: 10 })] });
    expect(screen.getByText(/25 in stock/).className).toContain('text-app-ink');
  });

  it('opens the edit form when the card body is clicked', () => {
    const { handlers } = renderGrid();
    fireEvent.click(screen.getByText('Bond Paper'));
    expect(handlers.onEditItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }));
  });

  it('does NOT open the edit form when the checkbox is clicked', () => {
    const toggle = vi.fn();
    const { handlers } = renderGrid({ selection: selection({ toggle }) });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select SKU-001' }));
    expect(toggle).toHaveBeenCalled();
    expect(handlers.onEditItem).not.toHaveBeenCalled();
  });

  it('shows the fallback initials when there is no photo', () => {
    renderGrid();
    expect(screen.getByText('BP')).toBeInTheDocument();
  });

  it('renders the photo, and no initials, when there is one', () => {
    renderGrid({ items: [item({ imageUrl: 'https://example.test/p.png' })] });
    expect(screen.getByAltText('Bond Paper')).toBeInTheDocument();
    expect(screen.queryByText('BP')).toBeNull();
  });

  /*
   * The gallery draws a ~215px box, so it must ask Storage for a resized copy
   * rather than the original — the sources ran to 2000×3000, 21.8 MP across
   * these tiles. Pinned here because the rewrite is invisible: the card looks
   * identical whether it loads 378 KB or 963 KB, and nothing else would fail.
   */
  it('asks Storage for a thumbnail, not the full-size original', () => {
    const original = 'https://proj.supabase.co/storage/v1/object/public/inventory-assets/photo.png';
    renderGrid({ items: [item({ imageUrl: original })] });
    const src = screen.getByAltText('Bond Paper').getAttribute('src') ?? '';
    expect(src).toContain('/storage/v1/render/image/public/');
    expect(src).toContain('width=400');
    expect(src).not.toContain('/object/public/');
  });

  it('leaves a photo that is not in Storage exactly as it is', () => {
    // A rewrite that touches URLs it does not understand produces broken images
    // that are indistinguishable from missing files.
    renderGrid({ items: [item({ imageUrl: 'https://example.test/photo.png' })] });
    expect(screen.getByAltText('Bond Paper').getAttribute('src')).toBe('https://example.test/photo.png');
  });

  /*
   * The header carries no count line — in either state.
   *
   * The gallery used to open with "N stock items", swapping to "N items
   * selected" while cards were ticked. The table view never had that line, so
   * the same surface read differently depending on which shape you were in, and
   * the figure was already reported by the pager at the foot of the card. Both
   * of these tests used to assert the line's presence; they now pin its absence,
   * which is the only way the removal stays removed.
   */
  it('does not print an item count in the header', () => {
    renderGrid({ items: [item(), item({ id: 'i2', sku: 'SKU-002' })] });
    expect(screen.queryByText('2 stock items')).toBeNull();
    expect(screen.queryByText('1 stock item')).toBeNull();
  });

  it('does not swap in a selection message when cards are ticked, as the table does not', () => {
    renderGrid({
      items: [item(), item({ id: 'i2', sku: 'SKU-002' })],
      selection: selection({ count: 1, has: (id) => id === 'i1' }),
    });
    expect(screen.queryByText('1 item selected')).toBeNull();
    expect(screen.queryByText('2 stock items')).toBeNull();
  });

  it('disables the delete square until something is ticked', () => {
    renderGrid();
    expect(screen.getByRole('button', { name: /delete selected stock items/i })).toBeDisabled();
  });

  it('enables the delete square once something is ticked', () => {
    renderGrid({ selection: selection({ count: 2 }) });
    expect(screen.getByRole('button', { name: /delete 2 selected stock items/i })).toBeEnabled();
  });

  it('shows the empty state, not a grid, when there are no items', () => {
    renderGrid({ items: [] });
    expect(screen.getByText('No stock items found')).toBeInTheDocument();
    expect(screen.queryByText('0 stock items')).toBeNull();
  });

  it('renders the pager only when the caller passes one', () => {
    const { rerender } = renderGrid();
    expect(screen.queryByText(/total/i)).toBeNull();
    rerender(
      <InventoryImageGrid
        items={[item()]}
        searchTerm=""
        selection={selection()}
        onSearchTermChange={vi.fn()}
        onRefresh={vi.fn()}
        onAddItem={vi.fn()}
        onEditItem={vi.fn()}
        onDeleteSelected={vi.fn()}
        view="image"
        onViewChange={vi.fn()}
        footer={<span>Pager</span>}
      />,
    );
    expect(screen.getByText('Pager')).toBeInTheDocument();
  });
});
