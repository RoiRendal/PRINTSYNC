import { describe, expect, it } from 'vitest';
import { ADMIN_PAGE_ACCESS, STAFF_PAGE_ACCESS } from '../../../shared/constants/navigation';
import { getDefaultAccess, normalizeAccess } from './access';

/**
 * `normalizeAccess` is the single place a role's page list is decided — the
 * session payload, the route guards and the user directory all pass through it,
 * so a mistake here shows up as a page that quietly vanishes from the sidebar.
 *
 * The `dashboard` case is the one that is not obvious from the outside. The
 * backend already sends `dashboard` for staff (the `dashboard.read` grant maps
 * to it, see `permissionToPage` in `users.service.ts`), so the page was never
 * missing from the payload — it was *this* clamp, filtering against
 * `STAFF_PAGE_ACCESS`, that used to strip it. These tests pin that.
 */
describe('normalizeAccess', () => {
  it('keeps dashboard for a staff session that carries the grant', () => {
    const access = normalizeAccess('staff', [
      'dashboard',
      'orders',
      'pos',
      'inventory',
      'customers',
    ]);
    expect(access).toContain('dashboard');
    expect(access).toEqual(['dashboard', 'orders', 'pos', 'inventory', 'customers']);
  });

  it('still clamps a staff session to the staff list', () => {
    // Asking for admin-only pages must not grant them.
    expect(normalizeAccess('staff', ['analytics', 'users', 'settings', 'audit'])).toEqual([]);
  });

  it('drops an admin-only page from an otherwise valid staff list', () => {
    expect(normalizeAccess('staff', ['dashboard', 'analytics'])).toEqual(['dashboard']);
  });

  it('falls back to the role default when no list is supplied', () => {
    expect(normalizeAccess('staff')).toEqual(STAFF_PAGE_ACCESS);
    expect(normalizeAccess('admin')).toEqual(ADMIN_PAGE_ACCESS);
  });

  it('de-duplicates while preserving the given order', () => {
    expect(normalizeAccess('staff', ['orders', 'orders', 'dashboard'])).toEqual([
      'orders',
      'dashboard',
    ]);
  });
});

describe('getDefaultAccess', () => {
  it('gives a newly created staff user the dashboard', () => {
    expect(getDefaultAccess('staff')).toContain('dashboard');
  });

  it('gives a newly created admin every page', () => {
    expect(getDefaultAccess('admin')).toEqual(ADMIN_PAGE_ACCESS);
  });
});
