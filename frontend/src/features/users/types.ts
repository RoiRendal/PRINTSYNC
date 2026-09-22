/**
 * The user directory contract lives in `@printsync/shared-types`. `UserSummary`,
 * `CreateUserInput`, `UpdateUserInput`, `SessionUser` and `AuthResponse` are
 * re-exported from there so the auth session and the user directory cannot drift
 * apart. The bits below are frontend-only: the role alias, the signed-in user
 * (a directory record minus its audit timestamp), and the login payload.
 */
import type {
  UserSummary,
  CreateUserInput,
  UpdateUserInput,
  SessionUser,
  AuthResponse,
  UserRole,
} from '@printsync/shared-types';

export type {
  UserSummary,
  CreateUserInput,
  UpdateUserInput,
  SessionUser,
  AuthResponse,
  UserRole,
};

/** Canonical RBAC role, shared with the backend contract. */
export type RbacRole = UserRole;

/** The signed-in user: a directory record without the audit timestamp. */
export type AuthUser = Omit<UserSummary, 'createdAt'>;

export interface LoginInput {
  email: string;
  password: string;
}
