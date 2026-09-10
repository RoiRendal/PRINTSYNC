import React, { createContext, useContext, useEffect, useState } from 'react';
import { usersApi } from '../api/usersApi';
import { ApiError } from '../../../shared/api/errors';
import { ADMIN_PAGE_ACCESS, getPageAccessKey, PageAccessKey, STAFF_PAGE_ACCESS } from '../../../shared/constants/navigation';

export type RbacRole = 'admin' | 'staff';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: RbacRole;
  position: string;
  createdAt: string;
  access: PageAccessKey[];
}

interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  role: RbacRole;
  position: string;
  createdAt?: string;
  password: string;
  access: PageAccessKey[];
}

interface UpdateUserInput {
  name: string;
  email: string;
  phone: string;
  role: RbacRole;
  position: string;
  createdAt: string;
  password: string;
  access: PageAccessKey[];
}

interface UserContextValue {
  users: UserRecord[];
  currentUser: UserRecord | null;
  isLoading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  createUser: (payload: CreateUserInput) => void;
  updateUser: (id: string, payload: UpdateUserInput) => void;
  deleteUser: (id: string) => boolean;
  canAccess: (path: string) => boolean;
  getDefaultAccess: (role: RbacRole) => PageAccessKey[];
  firstAdminId: string;
}

const FIRST_ADMIN_ID = 'u-admin-1';

const normalizeAccess = (role: RbacRole, access?: PageAccessKey[]) => {
  const allowed = role === 'admin' ? ADMIN_PAGE_ACCESS : STAFF_PAGE_ACCESS;
  const candidate = access && access.length ? access : allowed;
  const unique = Array.from(new Set(candidate));
  return unique.filter((entry): entry is PageAccessKey => allowed.includes(entry));
};

const INITIAL_USERS: UserRecord[] = [
  {
    id: 'u-admin-1',
    name: 'Irene Saquian',
    email: 'admin@printsync.com',
    phone: '09171234567',
    role: 'admin',
    position: 'System Administrator',
    createdAt: '2026-01-05',
    access: ADMIN_PAGE_ACCESS,
  },
  {
    id: 'u-staff-1',
    name: 'Noah Ramirez',
    email: 'noah@printsync.com',
    phone: '09181234567',
    role: 'staff',
    position: 'Print Technician',
    createdAt: '2026-02-14',
    access: STAFF_PAGE_ACCESS,
  },
  {
    id: 'u-staff-2',
    name: 'Mika Dela Cruz',
    email: 'mika@printsync.com',
    phone: '09191234567',
    role: 'staff',
    position: 'Production Assistant',
    createdAt: '2026-03-03',
    access: STAFF_PAGE_ACCESS,
  },
];

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const toUserRecord = (user: Awaited<ReturnType<typeof usersApi.session>>): UserRecord | null => {
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
      createdAt: '',
      access: normalizeAccess(role, access),
    };
  };

  useEffect(() => {
    let isMounted = true;
    void usersApi.session()
      .then((session) => {
        if (isMounted) setCurrentUser(toUserRecord(session));
      })
      .catch((error: unknown) => {
        if (isMounted && (!(error instanceof ApiError) || error.status !== 401)) {
          setAuthError('Unable to restore your session.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
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
      setCurrentUser(toUserRecord(sessionUser));
      return true;
    } catch (error: unknown) {
      setAuthError(error instanceof ApiError && error.status === 401 ? 'Invalid email or password.' : 'Unable to sign in right now.');
      return false;
    }
  };

  const logout = async () => {
    await usersApi.logout();
    setCurrentUser(null);
  };

  const createUser = (payload: CreateUserInput) => {
    const createdAt = payload.createdAt && payload.createdAt.trim() ? payload.createdAt : new Date().toISOString().slice(0, 10);
    const newUser: UserRecord = {
      id: `u-${Date.now()}`,
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone.trim(),
      role: payload.role,
      position: payload.position.trim(),
      createdAt,
      access: normalizeAccess(payload.role, payload.access),
    };
    setUsers((prev) => [newUser, ...prev]);
  };

  const updateUser = (id: string, payload: UpdateUserInput) => {
    const { password: _password, ...safePayload } = payload;
    setUsers((prev) =>
      prev.map((user) =>
        user.id === id
          ? {
              ...user,
              ...safePayload,
              email: payload.email.trim().toLowerCase(),
              name: payload.name.trim(),
              phone: payload.phone.trim(),
              position: payload.position.trim(),
              access: normalizeAccess(payload.role, payload.access),
            }
          : user
      )
    );
  };

  const deleteUser = (id: string) => {
    if (id === FIRST_ADMIN_ID) {
      return false;
    }
    setUsers((prev) => prev.filter((user) => user.id !== id));
    setCurrentUser((prev) => (prev?.id === id ? null : prev));
    return true;
  };

  return (
    <UserContext.Provider
      value={{
        users,
        currentUser,
        isLoading,
        authError,
        login,
        logout,
        createUser,
        updateUser,
        deleteUser,
        canAccess,
        getDefaultAccess,
        firstAdminId: FIRST_ADMIN_ID,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within UserProvider');
  }
  return context;
};
