import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { InventoryTable } from './InventoryTable';
import { useRowSelection } from '../../../shared/hooks/useRowSelection';
import type { InventoryItem } from '../types';

/*
 * The table's selection contract, pinned at the component level.
 *
 * The design being verified: a table has exactly **one** delete control, it lives
 * beside the search box rather than in every row, and it acts on whatever is
 * ticked. These tests exist because the failure mode is silent — a leftover
 * per-row delete would look perfectly fine and would quietly delete a single row
 * while the header button says "Delete (3)".
 */

function item(id: string, sku: string): InventoryItem {
  return {
    id,
    sku,
    name: `${sku} material`,
    category: 'T-shirt',
    stock: 20,
    reorderLevel: 5,
    price: 250,
    costPrice: 120,
    imageUrl: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

const ITEMS = [item('i1', 'SKU-1'), item('i2', 'SKU-2'), item('i3', 'SKU-3')];

/**
 * Stands in for the page: it owns the selection, exactly as `InventoryPage` does,
 * and records what the delete control hands back.
 */
function Harness({ items = ITEMS }: { items?: InventoryItem[] }) {
  const selection = useRowSelection(items.map((entry) => entry.id));
  const [requested, setRequested] = useState('');

  return (
    <>
      <InventoryTable
        items={items}
        totalCount={items.length}
        searchTerm=""
        onSearchTermChange={vi.fn()}
        onAddItem={vi.fn()}
        onEditItem={vi.fn()}
        onDeleteSelected={() => setRequested([...selection.selectedIds].join(','))}
        selection={selection}
      />
      <output data-testid="delete-request">{requested}</output>
    </>
  );
}

const deleteButton = () => screen.getByRole('button', { name: /delete/i });

describe('InventoryTable — one delete control, beside the search box', () => {
  it('renders exactly one delete button for the whole table', () => {
    render(<Harness />);
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(1);
  });

  it('leaves the actions column with edit only, one button per row', () => {
    render(<Harness />);
    // Row 0 is the header, so the data rows start at 1.
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows).toHaveLength(ITEMS.length);
    for (const row of dataRows) {
      expect(within(row).getAllByRole('button')).toHaveLength(1);
    }
  });

  it('keeps the delete button visible but disabled until a row is ticked', () => {
    render(<Harness />);
    expect(deleteButton()).toBeDisabled();
    expect(deleteButton()).toHaveTextContent('Delete');
  });
});

describe('InventoryTable — ticking rows', () => {
  it('gives every row a box, plus one in the header', () => {
    render(<Harness />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(ITEMS.length + 1);
  });

  it('enables the delete button and states the count once a row is ticked', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select SKU-2' }));

    expect(deleteButton()).toBeEnabled();
    expect(deleteButton()).toHaveTextContent('Delete (1)');
  });

  it('ticks every row from the header box, and reports the full count', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: /select all stock items/i }));

    for (const entry of ITEMS) {
      expect(screen.getByRole('checkbox', { name: `Select ${entry.sku}` })).toBeChecked();
    }
    expect(deleteButton()).toHaveTextContent('Delete (3)');
  });

  it('reports the header box as neither fully ticked nor empty on a partial selection', () => {
    render(<Harness />);
    const headerBox = screen.getByRole('checkbox', { name: /select all stock items/i });
    expect(headerBox).not.toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select SKU-1' }));
    // `indeterminate` is a DOM property, not an attribute — this is the state the
    // user actually sees, so assert the property itself.
    expect((headerBox as HTMLInputElement).indeterminate).toBe(true);
  });

  it('unticking the header box clears the whole selection', () => {
    render(<Harness />);
    const headerBox = screen.getByRole('checkbox', { name: /select all stock items/i });

    fireEvent.click(headerBox);
    fireEvent.click(headerBox);

    expect(deleteButton()).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Select SKU-1' })).not.toBeChecked();
  });
});

describe('InventoryTable — what the delete button hands to the page', () => {
  it('hands over only the ticked rows', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select SKU-1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select SKU-3' }));
    fireEvent.click(deleteButton());

    expect(screen.getByTestId('delete-request')).toHaveTextContent('i1,i3');
  });

  it('disables the header box, and offers no ticks, when the table is empty', () => {
    render(<Harness items={[]} />);
    expect(screen.getByRole('checkbox', { name: /select all stock items/i })).toBeDisabled();
    expect(deleteButton()).toBeDisabled();
  });
});
