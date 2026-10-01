import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignRepository } from './DesignRepository';

// Store mocked so the test proves the URL wiring without a backend.
vi.mock('../../../app/stores/useDesignStore', () => ({
  useDesigns: () => ({
    designs: [],
    total: 0,
    page: 1,
    limit: 20,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    goToPage: vi.fn(),
    addDesign: vi.fn(),
    updateDesign: vi.fn(),
    deleteDesign: vi.fn(),
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DesignRepository />
    </MemoryRouter>,
  );
}

/*
 * Where the design repository's chosen shape is kept.
 *
 * The grid is the DEFAULT here — the opposite of the stock surface, which
 * defaults to the table — so these assertions exist to stop that asymmetry
 * being quietly "fixed" into sameness by a later edit. It is deliberate (D4):
 * the repository has always been a wall of artwork.
 *
 * The picker itself is scaffolding and is replaced by the ERPNext-style dropdown
 * in P5; these tests name the buttons by label so that swap lands under them.
 */
describe('DesignRepository — view in the URL', () => {
  it('opens the image view by default', () => {
    renderAt('/inventory');
    expect(screen.getByRole('button', { name: 'Image View' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'List View' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens the list view when the URL asks for it', () => {
    renderAt('/inventory?designView=list');
    expect(screen.getByRole('button', { name: 'List View' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('falls back to the grid for a value it does not recognise', () => {
    renderAt('/inventory?designView=table');
    expect(screen.getByRole('button', { name: 'Image View' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switching to the list view marks it pressed', () => {
    renderAt('/inventory');
    fireEvent.click(screen.getByRole('button', { name: 'List View' }));
    expect(screen.getByRole('button', { name: 'List View' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switching back to the grid marks it pressed again', () => {
    renderAt('/inventory?designView=list');
    fireEvent.click(screen.getByRole('button', { name: 'Image View' }));
    expect(screen.getByRole('button', { name: 'Image View' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'List View' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('the repository opens as a grid even when the stock surface is a table', () => {
    // The two surfaces keep independent defaults, and the stock param must not
    // be read by the repository.
    renderAt('/inventory?stockView=image');
    expect(screen.getByRole('button', { name: 'Image View' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('DesignRepository — the list view column set', () => {
  it('renders Name, Category, Added and Actions headers', () => {
    renderAt('/inventory?designView=list');
    for (const label of ['Name', 'Category', 'Added', 'Actions']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
