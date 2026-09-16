import type { DataDomain } from '@printsync/shared-types';

/**
 * Which capability gates each domain's change events on the push channel.
 *
 * Filtering is per **permission**, never per role. If the permission model
 * changes — say staff are granted `users.read` — the stream follows
 * automatically with no code change here. A role-based filter would silently
 * drift out of step with the seeded grants, and drifting *upward* would leak
 * admin-only activity to every workstation.
 *
 * Against the permissions seeded in `supabase/migrations`, this means a staff
 * session receives every domain except `users` — staff hold `orders.read`,
 * `inventory.read`, `customers.read`, `designs.read`, `payments.read` and
 * `settings.read`, but `users.read` is granted to `admin` only. So user
 * management activity is the one thing that does not fan out to the shop floor.
 *
 * Kept out of the route module so the mapping can be unit-tested without
 * standing up Express or Supabase — it is the security boundary, so it is worth
 * testing directly.
 */
export const DOMAIN_READ_PERMISSION: Record<DataDomain, string> = {
  orders: 'orders.read',
  inventory: 'inventory.read',
  customers: 'customers.read',
  designs: 'designs.read',
  users: 'users.read',
  payments: 'payments.read',
  settings: 'settings.read',
};

/**
 * Every domain, in declaration order.
 *
 * Typed via the `Record` above rather than written out again, so a new domain
 * added to the shared union cannot be forgotten here — it would fail to satisfy
 * `Record<DataDomain, string>` first.
 */
export const DATA_DOMAINS = Object.keys(DOMAIN_READ_PERMISSION) as DataDomain[];

/**
 * The domains a session holding `permissions` is allowed to be told about.
 *
 * The payload carries no business data — only domain names — so a filtered
 * subscriber learns nothing they could not already learn by reloading a page
 * they are authorised to open. The filter exists so a staff workstation is not
 * prompted to refetch admin-only screens it cannot read.
 */
export function visibleDomainsFor(permissions: readonly string[]): DataDomain[] {
  return DATA_DOMAINS.filter((domain) => permissions.includes(DOMAIN_READ_PERMISSION[domain]));
}
