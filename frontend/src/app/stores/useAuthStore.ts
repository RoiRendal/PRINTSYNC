import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { usersApi } from '../../features/users/api/usersApi';
import type { AuthUser, RbacRole } from '../../features/users/types';
import { getDefaultAccess, normalizeAccess } from '../../features/users/utils/access';
import { ApiError } from '../../shared/api/errors';
import { ADMIN_PAGE_ACCESS, getPageAccessKey, type PageAccessKey } from '../../shared/constants/navigation';

interface AuthState {
  currentUser: AuthUser | null;
  isSessionLoading: boolean;
  authError: string | null;
  /** Guards against duplicate `/auth/session` calls (StrictMode double-mounts). */
  hasAttemptedRestore: boolean;
  /**
   * Called once from the app shell to rehydrate the session cookie.
   * Re-entrant: subsequent calls are no-ops until the user signs out.
   */
  restoreSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  canAccess: (path: string) => boolean;
  getDefaultAccess: (role: RbacRole) => PageAccessKey[];
}

/** Maps a backend session payload onto the RBAC user used across the UI. */
const toAuthUser = (user: Awaited<ReturnType<typeof usersApi.session>>): AuthUser | null => {
  if (!user) return null;
  /**
   * `users.manage` is the admin marker, not `users.read`.
   *
   * The two keys are separate on purpose — the API gates `GET /users` on
   * `users.read` and the write routes on `users.manage` — but this app models two
   * roles, and the line between them is "can change things", so `manage` is the
   * right discriminator here.
   *
   * Known limitation, and the reason `normalizeAccess` is called just below: a
   * hypothetical read-only role holding `users.read` without `users.manage` would
   * be labelled `staff`, and `normalizeAccess` clamps a `staff` session to
   * `STAFF_PAGE_ACCESS`, which does not list `users` — so the grant would be
   * stripped and the Users page would disappear. Adding a third role means
   * teaching `RbacRole`, `normalizeAccess` and the page-access lists about it;
   * it is not a one-line change.
   */
  const role: RbacRole = user.permissions.includes('users.manage') ? 'admin' : 'staff';
  // Backend permissions look like `orders.read`; the page key is the prefix.
  const access = user.permissions
    .map((permission) => permission.split('.')[0])
    .filter((permission): permission is PageAccessKey => ADMIN_PAGE_ACCESS.includes(permission as PageAccessKey));
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role,
    position: user.position,
    access: normalizeAccess(role, access),
  };
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  currentUser: null,
  isSessionLoading: true,
  authError: null,
  hasAttemptedRestore: false,

  restoreSession: async () => {
    if (get().hasAttemptedRestore) return;
    set({ hasAttemptedRestore: true, isSessionLoading: true });
    try {
      const session = await usersApi.session();
      set({ currentUser: toAuthUser(session), isSessionLoading: false, authError: null });
    } catch (error: unknown) {
      const isUnauthenticated = error instanceof ApiError && error.status === 401;
      set({
        currentUser: null,
        isSessionLoading: false,
        authError: isUnauthenticated ? null : 'Unable to restore your session.',
      });
    }
  },

  login: async (email, password) => {
    set({ authError: null });
    try {
      const sessionUser = await usersApi.login({ email, password });
      set({ currentUser: toAuthUser(sessionUser), authError: null });
      return true;
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        set({
          authError: error.status === 401
            ? 'Invalid email or password.'
            : `Sign-in failed (${error.status}): ${error.message}`,
        });
      } else if (error instanceof TypeError) {
        set({ authError: 'The backend could not be reached. Start the backend with "npm run dev" in the backend folder.' });
      } else {
        set({ authError: 'Unable to sign in right now.' });
      }
      return false;
    }
  },

  logout: async () => {
    await usersApi.logout();
    set({ currentUser: null, authError: null, hasAttemptedRestore: false });
  },

  canAccess: (path) => {
    const { currentUser } = get();
    if (!currentUser) return false;
    const key = getPageAccessKey(path);
    if (!key) return true;
    return currentUser.access.includes(key);
  },

  getDefaultAccess,
}));

/**
 * Drop-in replacement for the removed `AuthContext`.
 *
 * `useShallow` keeps the returned object identity stable so consumers only
 * re-render when one of the selected values actually changes.
 */
export function useAuth() {
  return useAuthStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      isSessionLoading: state.isSessionLoading,
      authError: state.authError,
      login: state.login,
      logout: state.logout,
      canAccess: state.canAccess,
      getDefaultAccess: state.getDefaultAccess,
    })),
  );
}
