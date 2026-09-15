import type { PageAccessKey } from '../../shared/constants/navigation';

/**
 * Canonical RBAC role. Shared by the auth session and the user directory so the
 * two can never drift apart.
 */
export type RbacRole = 'admin' | 'staff';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: RbacRole;
  position: string;
  createdAt: string;
  access: PageAccessKey[];
}

/** The signed-in user: a directory record without the audit timestamp. */
export type AuthUser = Omit<UserSummary, 'createdAt'>;

export interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  role: RbacRole;
  position: string;
  createdAt?: string;
  password: string;
  access: PageAccessKey[];
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & {
  password?: string;
};

export interface LoginInput {
  email: string;
  password: string;
}

export interface SessionUser extends UserSummary {
  roleId: string;
  permissions: string[];
}

export interface AuthResponse {
  user: SessionUser;
}
