import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnalyticsPage from './AnalyticsPage';

/*
 * The analytics page's branch selector — who sees it, and what is sent.
 *
 * The server refuses a staff account that names another branch, so this is not a
 * security boundary. It is a *correctness* one: a selector visible to staff would
 * let them make a choice the server then rejects, and the page would show an error
 * for a control that should not have been offered. The tests below pin the
 * visibility rule and the default, which are the two things a future edit is most
 * likely to get wrong.
 */

const mocks = vi.hoisted(() => ({
  useAnalyticsData: vi.fn(),
  useBranches: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useAnalyticsData', () => ({
  useAnalyticsData: mocks.useAnalyticsData,
}));

vi.mock('../../users/hooks/useBranches', () => ({
  useBranches: mocks.useBranches,
}));

vi.mock('../../../app/stores/useAuthStore', () => ({
  useAuth: mocks.useAuth,
}));

const BRANCHES = [
  { id: 'bal', code: 'BAL', name: 'Balayan', address: '', timeZone: 'Asia/Manila', isActive: true },
  { id: 'nas', code: 'NAS', name: 'Nasugbu', address: '', timeZone: 'Asia/Manila', isActive: true },
];

/** A neutral data state — every panel loading, so nothing else renders content. */
function emptyDataState() {
  return {
    dateRange: { from: '2026-01-01', to: '2026-12-31' },
    liveSummary: null,
    liveSummaryError: null,
    isLiveSummaryLoading: true,
    salesTimeline: null,
    salesTimelineError: null,
    isSalesTimelineLoading: true,
    profitTimeline: null,
    profitTimelineError: null,
    isProfitTimelineLoading: true,
    productTrends: null,
    productTrendsError: null,
    isProductTrendsLoading: true,
    inventoryForecast: null,
    inventoryForecastError: null,
    isInventoryForecastLoading: true,
    branchComparison: null,
    branchComparisonError: null,
    isBranchComparisonLoading: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAnalyticsData.mockReturnValue(emptyDataState());
  mocks.useBranches.mockReturnValue({ branches: BRANCHES, isLoading: false, error: null });
});

function renderAs(user: { canViewAllBranches: boolean; branchId: string | null }) {
  mocks.useAuth.mockReturnValue({ currentUser: user, isSessionLoading: false, authError: null });
  return render(
    <MemoryRouter>
      <AnalyticsPage />
    </MemoryRouter>,
  );
}

describe('AnalyticsPage — branch selector visibility', () => {
  it('staff see no branch selector', () => {
    renderAs({ canViewAllBranches: false, branchId: 'bal' });

    expect(screen.queryByLabelText('Branch to report on')).not.toBeInTheDocument();
    expect(screen.queryByText('Branch')).not.toBeInTheDocument();
  });

  it('head office see the branch selector', () => {
    renderAs({ canViewAllBranches: true, branchId: 'bal' });

    expect(screen.getByLabelText('Branch to report on')).toBeInTheDocument();
  });

  it('staff get no branch-comparison panel', () => {
    renderAs({ canViewAllBranches: false, branchId: 'bal' });

    expect(screen.queryByText('Branch Comparison')).not.toBeInTheDocument();
  });

  it('head office get the branch-comparison panel', () => {
    renderAs({ canViewAllBranches: true, branchId: 'bal' });

    expect(screen.getByText('Branch Comparison')).toBeInTheDocument();
  });
});

describe('AnalyticsPage — what is requested', () => {
  it('staff request their own branch (no explicit scope) and no comparison', () => {
    renderAs({ canViewAllBranches: false, branchId: 'bal' });

    const [, , , , branchScope, includeComparison] = mocks.useAnalyticsData.mock.calls[0]!;
    expect(branchScope).toBeUndefined();
    expect(includeComparison).toBe(false);
  });

  it('head office start on their own branch, with the comparison enabled', () => {
    // NOT the combined view by default. A page that opens on a two-shop total is a
    // number someone screenshots as "this month's sales".
    renderAs({ canViewAllBranches: true, branchId: 'bal' });

    const [, , , , branchScope, includeComparison] = mocks.useAnalyticsData.mock.calls[0]!;
    expect(branchScope).toBeUndefined();
    expect(includeComparison).toBe(true);
  });
});
