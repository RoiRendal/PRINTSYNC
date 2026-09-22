import { ADMIN_PAGE_ACCESS, STAFF_PAGE_ACCESS, type PageAccessKey } from '../../../shared/constants/navigation';
import type { RbacRole } from '../types';

/**
 * Clamps a raw access list to the pages the given role is allowed to see.
 *
 * Both the session payload (derived from backend permissions) and the user
 * directory rows pass through here, so the sidebar, route guards and user
 * management UI always agree on what a role can reach.
 */
export function normalizeAccess(role: RbacRole, access?: string[]): PageAccessKey[] {
  const allowed = role === 'admin' ? ADMIN_PAGE_ACCESS : STAFF_PAGE_ACCESS;
  const candidate: string[] = access && access.length ? access : allowed;
  return Array.from(new Set(candidate)).filter((entry): entry is PageAccessKey =>
    (allowed as readonly string[]).includes(entry),
  );
}

/** Default page access granted to a newly created user of the given role. */
export function getDefaultAccess(role: RbacRole): PageAccessKey[] {
  return normalizeAccess(role);
}
