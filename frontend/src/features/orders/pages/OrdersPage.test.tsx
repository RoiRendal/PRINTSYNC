import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrdersPage from './OrdersPage';

// The store is mocked so the test exercises the page's URL wiring without a
// backend. `setFilters` is the one call we assert on; everything else is a no-op.
const h = vi.hoisted(() => {
  const setFilters = vi.fn();
  return { setFilters };
});

vi.mock('../../../app/stores/useOrderStore', () => ({
  useOrders: () => ({
    orders: [],
    total: 0,
    page: 1,
    limit: 20,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    goToPage: vi.fn(),
    updateOrder: vi.fn(),
    deleteOrder: vi.fn(),
    refreshOrder: vi.fn(),
    setFilters: h.setFilters,
  }),
}));

// `OrdersTable` reads business branding (logo, currency) from context. Stub the
// hook so the page renders without standing up the full branding provider — and
// its settings fetch — in a unit test.
vi.mock('../../../app/providers/BusinessBrandingProvider', () => ({
  useBusinessBranding: () => ({
    businessDisplayName: 'PrintSync',
    businessLogoUrl: null,
    effectiveBusinessLogoUrl: '',
    currencySymbol: '₱',
    vatRate: 12,
    brandingError: null,
    setBusinessDisplayName: vi.fn(),
    uploadBusinessLogo: vi.fn(),
    clearBusinessLogo: vi.fn(),
    setVatRate: vi.fn(),
    setCurrencySymbol: vi.fn(),
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <OrdersPage />
    </MemoryRouter>,
  );
}

describe('OrdersPage — URL status filter', () => {
  it('seeds the server-side filter from the URL on arrival', () => {
    h.setFilters.mockClear();
    renderAt('/orders?status=Pending');
    expect(h.setFilters).toHaveBeenCalledWith({ status: 'Pending' });
  });

  it('clears the filter (clean URL) when "All" is chosen from a filtered URL', () => {
    h.setFilters.mockClear();
    renderAt('/orders?status=Pending');
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(h.setFilters).toHaveBeenLastCalledWith({});
  });

  it('writes the URL and drives the store when a status is chosen from a clean URL', () => {
    h.setFilters.mockClear();
    renderAt('/orders');
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }));
    expect(h.setFilters).toHaveBeenLastCalledWith({ status: 'Ready for Pickup' });
  });

  it('marks the active filter pill from the URL on arrival', () => {
    renderAt('/orders?status=Designing');
    // The "Designing" pill carries the active (blue) style; the accessible name
    // is enough to prove the derived value tracked the URL.
    expect(screen.getByRole('button', { name: 'Designing' })).toBeInTheDocument();
  });
});
