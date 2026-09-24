import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useUrlFilter } from './useUrlFilter';

function withRouter(initialEntries: string[]) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
}

describe('useUrlFilter', () => {
  it('reads the param from the URL on mount', () => {
    const { result } = renderHook(() => useUrlFilter('status', 'All'), {
      wrapper: withRouter(['/orders?status=Pending']),
    });
    expect(result.current[0]).toBe('Pending');
  });

  it('returns null when the param is absent', () => {
    const { result } = renderHook(() => useUrlFilter('status', 'All'), {
      wrapper: withRouter(['/orders']),
    });
    expect(result.current[0]).toBeNull();
  });

  it('writes the param when a value is set', () => {
    const { result } = renderHook(() => useUrlFilter('status', 'All'), {
      wrapper: withRouter(['/orders']),
    });
    act(() => result.current[1]('Ready for Pickup'));
    expect(result.current[0]).toBe('Ready for Pickup');
  });

  it('deletes the param (clean URL) when the clear value is set', () => {
    const { result } = renderHook(() => useUrlFilter('status', 'All'), {
      wrapper: withRouter(['/orders?status=Pending']),
    });
    act(() => result.current[1]('All'));
    expect(result.current[0]).toBeNull();
  });

  it('treats absence as cleared for a numeric flag too', () => {
    const { result } = renderHook(() => useUrlFilter('lowStock', ''), {
      wrapper: withRouter(['/inventory?lowStock=1']),
    });
    expect(result.current[0]).toBe('1');
    act(() => result.current[1](''));
    expect(result.current[0]).toBeNull();
  });
});
