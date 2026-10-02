import { ADMIN_PAGE_ACCESS, STAFF_PAGE_ACCESS, type PageAccessKey } from '../../../shared/constants/navigation';
import type { RbacRole } from '../types';

/**
 * Clamps a raw access list to the pages the given role is allowed to see.
 *
 * Both the session payload (derived from backend permissions) and the user
 * directory rows pass through here, so the sidebar, route guards and user
 * management UI always agree on what a role can reach.
 *
 * `owner` is treated as admin-tier: the head-office role was created to *widen*
 * reporting reach across branches, so clamping it to the staff page list would
 * give the owner less than an admin.
 */
export function normalizeAccess(role: RbacRole, access?: string[]): PageAccessKey[] {
  const allowed = isAdminTier(role) ? ADMIN_PAGE_ACCESS : STAFF_PAGE_ACCESS;
  const candidate: string[] = access && access.length ? access : allowed;
  return Array.from(new Set(candidate)).filter((entry): entry is PageAccessKey =>
    (allowed as readonly string[]).includes(entry),
  );
}

/** Default page access granted to a newly created user of the given role. */
export function getDefaultAccess(role: RbacRole): PageAccessKey[] {
  return normalizeAccess(role);
}

/**
 * Roles that see the full admin page list.
 *
 * One predicate rather than the `role === 'admin'` comparison repeated at each
 * call site: the third role was added in one branch-rollout change and there were
 * three such comparisons, each of which would have quietly demoted `owner` to a
 * staff page list if it had been missed.
 */
export function isAdminTier(role: RbacRole): boolean {
  return role === 'admin' || role === 'owner';
}
