import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesignTable } from './DesignTable';
import type { Design } from '../types';

/*
 * The design repository's List View.
 *
 * The claim this file pins is that the four per-card actions survive the move
 * into a row, unchanged and in the same order — View, Download, Edit, Delete.
 * A staff member switching shape should not have to relearn where things are,
 * and "the delete button moved" is not a thing a type-check or a screenshot of
 * the grid would catch.
 *
 * Also pinned: no select column. The repository has no bulk action, so a
 * checkbox column would be an affordance with nothing behind it.
 */

function design(overrides: Partial<Design> = {}): Design {
  return {
    id: 'd1',
    name: 'Modern Minimalist Logo',
    category: 'Logo',
    imageUrl: 'https://example.test/a.png',
    tags: [],
    assetType: 'image/png',
    assetSizeBytes: 1234,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
    ...overrides,
  };
}

function renderTable(props: Partial<React.ComponentProps<typeof DesignTable>> = {}) {
  const handlers = { onView: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  const result = render(<DesignTable designs={[design()]} {...handlers} {...props} />);
  return { ...result, handlers };
}

describe('DesignTable', () => {
  it('shows the name, category and added date', () => {
    renderTable();
    expect(screen.getByText('Modern Minimalist Logo')).toBeInTheDocument();
    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('2026-09-01')).toBeInTheDocument();
  });

  it('carries all four actions, in the order the card used', () => {
    renderTable();
    const labels = screen.getAllByRole('button').map((b) => (b.getAttribute('aria-label') ?? '').split(' ')[0]);
    expect(labels).toEqual(['View', 'Download', 'Edit', 'Delete']);
  });

  it('view, edit and delete call back with the design', () => {
    const { handlers } = renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'View Modern Minimalist Logo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Modern Minimalist Logo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Modern Minimalist Logo' }));
    expect(handlers.onView).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
    expect(handlers.onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
    expect(handlers.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
  });

  it('download opens the artwork in a new tab rather than navigating away', () => {
    const openSpy = vi.fn();
    const original = window.open;
    window.open = openSpy;
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Download Modern Minimalist Logo' }));
    window.open = original;
    expect(openSpy).toHaveBeenCalledWith('https://example.test/a.png', '_blank', 'noopener,noreferrer');
  });

  it('has no select column — there is no bulk action to tick for', () => {
    renderTable();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('renders one row per design', () => {
    renderTable({ designs: [design(), design({ id: 'd2', name: 'Second' })] });
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2
  });

  it('shows the empty state, spanning every column, when there are none', () => {
    renderTable({ designs: [] });
    expect(screen.getByText('No designs found')).toBeInTheDocument();
    const cell = screen.getByText('No designs found').closest('td');
    expect(cell).toHaveAttribute('colspan', '4');
  });

  it('renders the pager only when the caller passes one', () => {
    const { rerender } = renderTable();
    expect(screen.queryByText('Pager')).toBeNull();
    rerender(
      <DesignTable designs={[design()]} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} footer={<span>Pager</span>} />,
    );
    expect(screen.getByText('Pager')).toBeInTheDocument();
  });
});
