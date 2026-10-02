import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DesignTable } from './DesignTable';
import { useRowSelection } from '../../../shared/hooks/useRowSelection';
import type { Design } from '../types';

/*
 * The design repository's List View, pinned at the component level.
 *
 * The repository now draws the SAME table every other list screen draws: a tick
 * column, a clickable row, and no per-row action buttons. Those are the parts
 * that fail silently — a leftover per-row trash can would look perfectly fine
 * and would quietly delete one design while the header button says "Delete (3)",
 * and a row that stopped opening the editor is invisible in a screenshot.
 */

function design(overrides: Partial<Design> = {}): Design {
  return {
    id: 'd1',
    name: 'Modern Minimalist Logo',
    category: 'Logo',
    imageUrl: 'https://example.test/a.png',
    assetType: 'image/png',
    assetSizeBytes: 1234,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
    ...overrides,
  };
}

const DESIGNS = [design(), design({ id: 'd2', name: 'Second' })];

/** Stands in for the page: it owns the selection, as `DesignRepository` does. */
function Harness({
  designs = DESIGNS,
  onEdit = vi.fn(),
}: {
  designs?: Design[];
  onEdit?: (design: Design) => void;
}) {
  const selection = useRowSelection(designs.map((entry) => entry.id));

  return (
    <DesignTable
      designs={designs}
      onEdit={onEdit}
      selection={selection}
      footer={<span>Pager</span>}
    />
  );
}

describe('DesignTable — the shared list-table shape', () => {
  it('shows the name, category and added date', () => {
    render(<Harness designs={[design()]} />);
    expect(screen.getByText('Modern Minimalist Logo')).toBeInTheDocument();
    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('2026-09-01')).toBeInTheDocument();
  });

  it('has no Actions column — the row is the edit target', () => {
    render(<Harness designs={[design()]} />);
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
    // No column labels are missing beyond the three data columns + tick box.
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  });

  it('carries no button of any kind — the header owns the only controls', () => {
    render(<Harness />);
    expect(within(screen.getByRole('table')).queryAllByRole('button')).toHaveLength(0);
  });

  it('opens the editor when a row is clicked', () => {
    const onEdit = vi.fn();
    render(<Harness onEdit={onEdit} />);
    // Row 0 is the header, so the data rows start at 1.
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows).toHaveLength(DESIGNS.length);
    fireEvent.click(dataRows[0]);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(DESIGNS[0]);
  });

  it('renders the pager the caller passes', () => {
    render(<Harness designs={[design()]} />);
    expect(screen.getByText('Pager')).toBeInTheDocument();
  });

  it('shows the empty state, spanning tick column and every data column', () => {
    render(<Harness designs={[]} />);
    expect(screen.getByText('No designs found')).toBeInTheDocument();
    const cell = screen.getByText('No designs found').closest('td');
    // Three data columns plus the tick column.
    expect(cell).toHaveAttribute('colspan', '4');
  });
});

describe('DesignTable — ticking rows', () => {
  it('gives every row a box, plus one in the header', () => {
    render(<Harness />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(DESIGNS.length + 1);
  });

  it('collapses the whole header to the "# item(s) selected" message when a row is ticked', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Modern Minimalist Logo' }));

    // Every column label disappears; only the message is left in the header
    // (ERPNext item-list behaviour).
    expect(screen.queryByRole('columnheader', { name: 'Name' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: '1 item selected' })).toBeInTheDocument();
  });

  it('does NOT open the editor when the box is clicked', () => {
    // The box sits inside the clickable row, so a tick that does not stop
    // propagation would open the edit form every time somebody tidies the list.
    const onEdit = vi.fn();
    render(<Harness onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Modern Minimalist Logo' }));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('unticking the header box clears the whole selection', () => {
    render(<Harness />);
    const headerBox = screen.getByRole('checkbox', { name: /select all designs on this page/i });

    fireEvent.click(headerBox);
    expect(screen.getByRole('checkbox', { name: 'Select Modern Minimalist Logo' })).toBeChecked();

    fireEvent.click(headerBox);
    expect(screen.getByRole('checkbox', { name: 'Select Modern Minimalist Logo' })).not.toBeChecked();
  });

  it('reports the header box as neither fully ticked nor empty on a partial selection', () => {
    render(<Harness />);
    const headerBox = screen.getByRole('checkbox', { name: /select all designs on this page/i });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Second' }));
    // `indeterminate` is a DOM property, not an attribute.
    expect((headerBox as HTMLInputElement).indeterminate).toBe(true);
  });

  it('disables the header box when there is nothing to tick', () => {
    render(<Harness designs={[]} />);
    expect(screen.getByRole('checkbox', { name: /select all designs on this page/i })).toBeDisabled();
  });
});
