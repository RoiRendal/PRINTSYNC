import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ADMIN_PAGE_ACCESS, PageAccessKey, STAFF_PAGE_ACCESS } from '../../../shared/constants/navigation';

export type RbacRole = 'admin' | 'staff';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: RbacRole;
  position: string;
  createdAt: string;
  password: string;
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
  login: (email: string, password: string) => boolean;
  logout: () => void;
  createUser: (payload: CreateUserInput) => void;
  updateUser: (id: string, payload: UpdateUserInput) => void;
  deleteUser: (id: string) => boolean;
  canAccess: (path: string) => boolean;
  getDefaultAccess: (role: RbacRole) => PageAccessKey[];
  firstAdminId: string;
}

const USERS_STORAGE_KEY = 'printsync-users';
const AUTH_USER_STORAGE_KEY = 'printsync-auth-user';
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
    password: 'admin123',
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
    password: 'staff123',
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
    password: 'staff456',
    access: STAFF_PAGE_ACCESS,
  },
];

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [users, setUsers] = useState<UserRecord[]>(() => {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (!stored) {
      return INITIAL_USERS;
    }
    try {
      const parsed = JSON.parse(stored) as UserRecord[];
      if (!parsed.length) {
        return INITIAL_USERS;
      }
      return parsed.map((user) => ({
        ...user,
        access: normalizeAccess(user.role, user.access),
      }));
    } catch {
      return INITIAL_USERS;
    }
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return localStorage.getItem(AUTH_USER_STORAGE_KEY);
  });

  useEffect(() => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(AUTH_USER_STORAGE_KEY, currentUserId);
      return;
    }
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }, [currentUserId]);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [users, currentUserId]
  );

  const getDefaultAccess = (role: RbacRole) => normalizeAccess(role);

  const canAccess = (path: string) => {
    if (!currentUser) {
      return false;
    }
    const navPath = path === '' ? '/' : path;
    const map: Record<string, PageAccessKey> = {
      '/': 'dashboard',
      '/orders': 'orders',
      '/inventory': 'inventory',
      '/pos': 'pos',
      '/finance': 'finance',
      '/analytics': 'analytics',
      '/users': 'users',
      '/settings': 'settings',
    };
    const key = map[navPath];
    if (!key) {
      return true;
    }
    return currentUser.access.includes(key);
  };

  const login = (email: string, password: string) => {
    const match = users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase().trim() && user.password === password
    );

    if (!match) {
      return false;
    }

    setCurrentUserId(match.id);
    return true;
  };

  const logout = () => {
    setCurrentUserId(null);
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
      password: payload.password,
      access: normalizeAccess(payload.role, payload.access),
    };
    setUsers((prev) => [newUser, ...prev]);
  };

  const updateUser = (id: string, payload: UpdateUserInput) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === id
          ? {
              ...user,
              ...payload,
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
    setCurrentUserId((prev) => (prev === id ? null : prev));
    return true;
  };

  return (
    <UserContext.Provider
      value={{
        users,
        currentUser,
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
