import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import type { OrdersSummary } from '../../orders/types';

const hook = vi.hoisted(() => ({ useOrdersSummary: vi.fn() }));

vi.mock('../hooks/useOrdersSummary', () => ({
  useOrdersSummary: hook.useOrdersSummary,
}));

const SUMMARY: OrdersSummary = {
  total: 73,
  open: 14,
  byStatus: [
    { status: 'Pending', count: 3 },
    { status: 'Designing', count: 0 },
    { status: 'In Production', count: 4 },
    { status: 'Ready for Pickup', count: 5 },
    { status: 'Completed', count: 40 },
    { status: 'Delivered', count: 19 },
  ],
  lowStock: 5,
};

interface StateShape {
  summary: OrdersSummary | null;
  error: string | null;
  isLoading: boolean;
}

function setState(state: Partial<StateShape>) {
  hook.useOrdersSummary.mockReturnValue({
    summary: null,
    error: null,
    isLoading: false,
    refresh: vi.fn(),
    ...state,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

const hrefFor = (name: RegExp) => screen.getByRole('link', { name }).getAttribute('href') ?? '';

describe('DashboardPage — the Workspace', () => {
  it('links every work-waiting queue to its filtered list', () => {
    setState({ summary: SUMMARY });
    renderPage();

    expect(hrefFor(/pending/i)).toBe('/orders?status=Pending');
    expect(hrefFor(/designing/i)).toBe('/orders?status=Designing');
    expect(hrefFor(/in production/i)).toContain('status=In');
    expect(hrefFor(/ready for pickup/i)).toContain('status=Ready');
    expect(hrefFor(/low stock/i)).toBe('/inventory?lowStock=1');
  });

  it('shows the counts from the summary, zero-filling an empty status', () => {
    setState({ summary: SUMMARY });
    renderPage();

    expect(screen.getByRole('link', { name: /pending/i })).toHaveTextContent('3');
    // Designing has no orders — the card still renders a 0, it does not vanish.
    expect(screen.getByRole('link', { name: /designing/i })).toHaveTextContent('0');
    expect(screen.getByRole('link', { name: /low stock/i })).toHaveTextContent('5');
  });

  it('shows a loading state on first load, before any count exists', () => {
    setState({ summary: null, isLoading: true });
    renderPage();

    expect(screen.getByText(/loading workspace/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /pending/i })).not.toBeInTheDocument();
  });

  it('says so on failure and renders no zero cards', () => {
    setState({ summary: null, error: 'The workspace counts could not be loaded.' });
    renderPage();

    expect(screen.getByText(/workspace unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    // Crucially, no tiles: a screen of zeros would look like a quiet morning.
    expect(screen.queryByRole('link', { name: /pending/i })).not.toBeInTheDocument();
  });

  it('notes when nothing is waiting', () => {
    setState({
      summary: {
        ...SUMMARY,
        lowStock: 0,
        byStatus: SUMMARY.byStatus.map((entry) => ({ ...entry, count: 0 })),
      },
    });
    renderPage();

    expect(screen.getByText(/nothing is waiting/i)).toBeInTheDocument();
  });
});
