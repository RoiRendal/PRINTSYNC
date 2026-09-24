import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useOrdersSummary } from './useOrdersSummary';
import { emitDataChange } from '../../../shared/store/dataEvents';
import { ApiError } from '../../../shared/api/errors';
import type { OrdersSummary } from '../../orders/types';

const api = vi.hoisted(() => ({ summary: vi.fn() }));

vi.mock('../api/dashboardApi', () => ({
  dashboardApi: { summary: api.summary },
}));

const SUMMARY: OrdersSummary = {
  total: 73,
  open: 14,
  byStatus: [
    { status: 'Pending', count: 3 },
    { status: 'Designing', count: 2 },
    { status: 'In Production', count: 4 },
    { status: 'Ready for Pickup', count: 5 },
    { status: 'Completed', count: 40 },
    { status: 'Delivered', count: 19 },
  ],
  lowStock: 5,
};

describe('useOrdersSummary', () => {
  it('loads the summary on mount', async () => {
    api.summary.mockResolvedValue(SUMMARY);
    const { result } = renderHook(() => useOrdersSummary());
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fails loudly: sets the error, keeps no summary, invents no fallback', async () => {
    api.summary.mockRejectedValue(new ApiError('Orders summary failed', 503));
    const { result } = renderHook(() => useOrdersSummary());
    await waitFor(() => expect(result.current.error).toBe('Orders summary failed'));
    expect(result.current.summary).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('uses a readable message for a non-ApiError failure', async () => {
    api.summary.mockRejectedValue(new Error('socket closed'));
    const { result } = renderHook(() => useOrdersSummary());
    await waitFor(() =>
      expect(result.current.error).toBe('The workspace counts could not be loaded.'),
    );
  });

  it('keeps the last good counts when a later reload fails', async () => {
    api.summary.mockResolvedValueOnce(SUMMARY);
    const { result } = renderHook(() => useOrdersSummary());
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));

    api.summary.mockRejectedValueOnce(new ApiError('nope', 503));
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.error).toBe('nope'));
    // The stale counts survive the failed reload rather than blanking the screen.
    expect(result.current.summary).toEqual(SUMMARY);
  });

  it('reloads when the orders domain is announced', async () => {
    api.summary.mockResolvedValue(SUMMARY);
    renderHook(() => useOrdersSummary());
    await waitFor(() => expect(api.summary).toHaveBeenCalledTimes(1));

    act(() => {
      emitDataChange('orders');
    });
    await waitFor(() => expect(api.summary).toHaveBeenCalledTimes(2), { timeout: 2000 });
  });

  it('ignores a domain the Workspace does not show', async () => {
    api.summary.mockResolvedValue(SUMMARY);
    renderHook(() => useOrdersSummary());
    await waitFor(() => expect(api.summary).toHaveBeenCalledTimes(1));

    act(() => {
      emitDataChange('settings');
    });
    // Past the debounce window; a change that cannot move a count must not reload.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(api.summary).toHaveBeenCalledTimes(1);
  });
});
