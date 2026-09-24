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
