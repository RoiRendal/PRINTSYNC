import React, { createContext, useContext, useEffect, useState } from 'react';
import { usersApi } from '../api/usersApi';
import { ApiError } from '../../../shared/api/errors';
import { ADMIN_PAGE_ACCESS, getPageAccessKey, PageAccessKey, STAFF_PAGE_ACCESS } from '../../../shared/constants/navigation';

export type RbacRole = 'admin' | 'staff';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: RbacRole;
  position: string;
  access: PageAccessKey[];
}

interface AuthContextValue {
  currentUser: AuthUser | null;
  isSessionLoading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  canAccess: (path: string) => boolean;
  getDefaultAccess: (role: RbacRole) => PageAccessKey[];
}

const normalizeAccess = (role: RbacRole, access?: PageAccessKey[]) => {
  const allowed = role === 'admin' ? ADMIN_PAGE_ACCESS : STAFF_PAGE_ACCESS;
  const candidate = access && access.length ? access : allowed;
  const unique = Array.from(new Set(candidate));
  return unique.filter((entry): entry is PageAccessKey => allowed.includes(entry));
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const toAuthUser = (user: Awaited<ReturnType<typeof usersApi.session>>): AuthUser | null => {
  if (!user) return null;
  const role: RbacRole = user.permissions.includes('users.manage') ? 'admin' : 'staff';
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void usersApi.session()
      .then((session) => {
        if (isMounted) setCurrentUser(toAuthUser(session));
      })
      .catch((error: unknown) => {
        if (isMounted && (!(error instanceof ApiError) || error.status !== 401)) {
          setAuthError('Unable to restore your session.');
        }
      })
      .finally(() => {
        if (isMounted) setIsSessionLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const getDefaultAccess = (role: RbacRole) => normalizeAccess(role);

  const canAccess = (path: string) => {
    if (!currentUser) {
      return false;
    }
    const key = getPageAccessKey(path);
    if (!key) {
      return true;
    }
    return currentUser.access.includes(key);
  };

  const login = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const sessionUser = await usersApi.login({ email, password });
      setCurrentUser(toAuthUser(sessionUser));
      return true;
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setAuthError(error.status === 401 ? 'Invalid email or password.' : `Sign-in failed (${error.status}): ${error.message}`);
      } else if (error instanceof TypeError) {
        setAuthError('The backend could not be reached. Start the backend with "npm run dev" in the backend folder.');
      } else {
        setAuthError('Unable to sign in right now.');
      }
      return false;
    }
  };

  const logout = async () => {
    await usersApi.logout();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isSessionLoading,
        authError,
        login,
        logout,
        canAccess,
        getDefaultAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
