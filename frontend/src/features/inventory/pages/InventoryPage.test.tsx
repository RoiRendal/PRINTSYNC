import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InventoryPage from './InventoryPage';

// Store mocked so the test proves the page's URL wiring without a backend.
const h = vi.hoisted(() => {
  const setFilters = vi.fn();
  return { setFilters };
});

vi.mock('../../../app/stores/useInventoryStore', () => ({
  useInventory: () => ({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    goToPage: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    setFilters: h.setFilters,
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <InventoryPage />
    </MemoryRouter>,
  );
}

describe('InventoryPage — URL lowStock filter', () => {
  it('seeds the server-side low-stock filter from the URL on arrival', () => {
    h.setFilters.mockClear();
    renderAt('/inventory?lowStock=1');
    expect(h.setFilters).toHaveBeenCalledWith({ lowStock: 1 });
  });

  it('toggles low stock on and off, driving the store each time', () => {
    h.setFilters.mockClear();
    renderAt('/inventory');
    const toggle = screen.getByRole('button', { name: /low stock only/i });

    fireEvent.click(toggle);
    expect(h.setFilters).toHaveBeenLastCalledWith({ lowStock: 1 });

    fireEvent.click(toggle);
    expect(h.setFilters).toHaveBeenLastCalledWith({});
  });

  it('renders the low-stock toggle in the inventory view', () => {
    renderAt('/inventory');
    expect(screen.getByRole('button', { name: /low stock only/i })).toBeInTheDocument();
  });
});

/*
 * The SURFACE — stock list vs design repository.
 *
 * This is in the URL because nothing downstream of it is shareable otherwise:
 * the design repo's own `?designView=list` is meaningless unless the surface
 * that reads it is the one on screen. Before this moved out of `useState`, a
 * refresh from the repository dropped you back on the stock list.
 */
describe('InventoryPage — surface in the URL', () => {
  it('opens the stock list by default', () => {
    renderAt('/inventory');
    expect(screen.getByRole('button', { name: /low stock only/i })).toBeInTheDocument();
  });

  it('opens the design repository when the URL asks for it', () => {
    renderAt('/inventory?surface=designs');
    expect(screen.queryByRole('button', { name: /low stock only/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Design view' })).toBeInTheDocument();
  });

  it('falls back to the stock list for a value it does not recognise', () => {
    renderAt('/inventory?surface=artwork');
    expect(screen.getByRole('button', { name: /low stock only/i })).toBeInTheDocument();
  });

  it('the two surfaces read their own view param and ignore the other', () => {
    // A stock view param must not confuse the repository, and vice versa: each
    // surface owns its own control, named for the surface it belongs to.
    renderAt('/inventory?surface=designs&stockView=image');
    expect(screen.getByRole('button', { name: 'Design view' })).toHaveTextContent('Image View');
    expect(screen.queryByRole('button', { name: 'Stock view' })).toBeNull();
  });
});

/*
 * The stock view picker, pinned at the page level.
 *
 * These assertions are about WHERE the choice is kept — the URL — not about how
 * the gallery looks. The URL is the part a refresh, a Back press and a shared
 * link all depend on, and it is the part that silently breaks: a picker wired to
 * `useState` passes every visual review and loses the choice on reload.
 *
 * The control itself is scaffolding and is replaced in P5 by the ERPNext-style
 * dropdown; these tests name the buttons by their label so that swap changes the
 * implementation under them rather than the expectations.
 */
describe('InventoryPage — stock view in the URL', () => {
  const trigger = () => screen.getByRole('button', { name: 'Stock view' });

  it('shows the list view as current by default', () => {
    renderAt('/inventory');
    expect(trigger()).toHaveTextContent('List View');
  });

  it('is a menu button, not a pair of pressed buttons', () => {
    renderAt('/inventory');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the image view as current when the URL asks for it', () => {
    renderAt('/inventory?stockView=image');
    expect(trigger()).toHaveTextContent('Image View');
  });

  it('falls back to the list for a value it does not recognise', () => {
    renderAt('/inventory?stockView=gallery');
    expect(trigger()).toHaveTextContent('List View');
  });

  it('the menu lists both views, in order, marking the current one', () => {
    renderAt('/inventory');
    fireEvent.click(trigger());
    const options = screen.getAllByRole('menuitemradio');
    expect(options.map((option) => option.textContent)).toEqual(['List View', 'Image View']);
    expect(options[0]).toHaveAttribute('aria-checked', 'true');
    expect(options[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('choosing the other view makes it current and closes the menu', () => {
    renderAt('/inventory');
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Image View' }));
    expect(trigger()).toHaveTextContent('Image View');
    expect(screen.queryByRole('menuitemradio')).toBeNull();
  });
});
