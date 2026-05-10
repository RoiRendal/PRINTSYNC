import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
}

interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  role: RbacRole;
  position: string;
  createdAt?: string;
  password: string;
}

interface UpdateUserInput {
  name: string;
  email: string;
  phone: string;
  role: RbacRole;
  position: string;
  createdAt: string;
  password: string;
}

interface UserContextValue {
  users: UserRecord[];
  currentUser: UserRecord | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  createUser: (payload: CreateUserInput) => void;
  updateUser: (id: string, payload: UpdateUserInput) => void;
  deleteUser: (id: string) => void;
}

const USERS_STORAGE_KEY = 'printsync-users';
const AUTH_USER_STORAGE_KEY = 'printsync-auth-user';

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
      return parsed.length ? parsed : INITIAL_USERS;
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
            }
          : user
      )
    );
  };

  const deleteUser = (id: string) => {
    setUsers((prev) => prev.filter((user) => user.id !== id));
    setCurrentUserId((prev) => (prev === id ? null : prev));
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
