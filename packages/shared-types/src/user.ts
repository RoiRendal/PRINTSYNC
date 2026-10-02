export type UserRole = 'admin' | 'staff' | 'owner';

/**
 * A physical shop.
 *
 * `code` is the short form used in document references (`BAL-0001`) and anywhere
 * a branch has to fit a fixed-width label, such as a receipt header. It is
 * uppercase and free of spaces for that reason.
 */
export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string;
  timeZone: string;
  isActive: boolean;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  position: string;
  /**
   * The branch this account belongs to, or `null` in the brief window between the
   * auth row existing and its profile row being written. Every provisioned user
   * has one.
   */
  branchId: string | null;
  /** Head office / owner only. Read-across for analytics; never a cross-branch write. */
  canViewAllBranches: boolean;
  createdAt: string;
  access: string[];
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  position: string;
  branchId: string;
  createdAt?: string;
  password: string;
  access: string[];
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & {
  password?: string;
};

/**
 * The signed-in account, as `/auth/login`, `/auth/refresh` and `/auth/session`
 * return it.
 *
 * ### Why it is not `UserSummary`
 *
 * It used to extend `UserSummary`, which promised `createdAt` and `access` that
 * the session has never sent. Neither is meaningful here: `createdAt` describes a
 * *directory row* ("when was this person added"), not the act of signing in, and
 * `access` is **derived**, not stored — the client computes it from `permissions`
 * via `normalizeAccess`, which is also what clamps it to the pages the role may
 * reach. A session payload that shipped an `access` list would let the client
 * decide its own page access, which is the opposite of the intended direction.
 *
 * The `Omit` is therefore written out explicitly rather than inherited, so the
 * difference from a directory row is stated instead of implied. `role` is
 * required here because the client's `isAdminTier` compares against it — while it
 * was absent, `normalizeAccess(undefined, …)` clamped *every* account, admin
 * included, to the staff page list.
 */
export interface SessionUser extends Omit<UserSummary, 'createdAt' | 'access'> {
  roleId: string;
  permissions: string[];
}

export interface AuthResponse {
  user: SessionUser;
}
