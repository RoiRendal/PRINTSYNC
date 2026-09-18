import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { Sidebar } from './AppSidebar';
import { useAuthStore } from '../stores/useAuthStore';
import { STAFF_PAGE_ACCESS } from '../../shared/constants/navigation';
import type { AuthUser } from '../../features/users/types';

/*
 * Phase 1 removed the sidebar collapse control, and with it the `isCollapsed`
 * prop this component used to take. The rail is now always full width, and
 * visibility belongs entirely to `AppLayout` (which hides it below `lg` unless
 * the mobile drawer is open).
 *
 * That rewrite changed this component's props and its markup, so this is the
 * cheapest place to guard the two things it could silently break: the rail still
 * renders exactly the pages the signed-in user is entitled to, and it no longer
 * exposes any collapse affordance.
 *
 * Kept at the component level on purpose — `MemoryRouter` plus a seeded store, no
 * providers. The project's own convention (see `POSCheckoutModal.test.tsx`) is to
 * avoid standing up provider scaffolding that has nothing to do with the
 * assertions.
 */

const staffUser: AuthUser = {
  id: 'u-1',
  name: 'Ada Staff',
  email: 'ada@example.test',
  phone: '',
  role: 'staff',
  position: 'Cashier',
  access: [...STAFF_PAGE_ACCESS],
};

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );
}

afterEach(() => {
  useAuthStore.setState({ currentUser: null });
});

describe('the navigation rail', () => {
  it('renders only the pages the signed-in user can reach', () => {
    useAuthStore.setState({ currentUser: staffUser });

    renderSidebar();

    expect(screen.getByRole('link', { name: /point of sale/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /orders/i })).toBeInTheDocument();
    // Deliberately not granted to staff — it must not leak into the rail.
    expect(screen.queryByRole('link', { name: /analytics/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /users/i })).not.toBeInTheDocument();
  });

  it('offers no collapse control', () => {
    useAuthStore.setState({ currentUser: staffUser });

    renderSidebar();

    // The collapse toggle lived in the page toolbar and is gone by design; the
    // rail itself has never held a button, and must not gain one back.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders no navigation at all when nobody is signed in', () => {
    useAuthStore.setState({ currentUser: null });

    renderSidebar();

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
