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

export interface SessionUser extends UserSummary {
  roleId: string;
  permissions: string[];
}

export interface AuthResponse {
  user: SessionUser;
}
