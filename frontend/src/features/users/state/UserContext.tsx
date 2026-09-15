import React, { createContext, useContext, useEffect, useState } from 'react';
import { usersApi } from '../api/usersApi';
import { ApiError } from '../../../shared/api/errors';
import { ADMIN_PAGE_ACCESS, PageAccessKey, STAFF_PAGE_ACCESS } from '../../../shared/constants/navigation';
import { useAuth, type AuthUser, type RbacRole } from './AuthContext';

export type { RbacRole, AuthUser } from './AuthContext';

export interface UserRecord extends AuthUser {
  createdAt: string;
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
  total: number;
  page: number;
  limit: number;
  isUsersLoading: boolean;
  userError: string | null;
  refreshUsers: () => void;
  goToPage: (page: number) => void;
  createUser: (payload: CreateUserInput) => Promise<UserRecord>;
  updateUser: (id: string, payload: UpdateUserInput) => Promise<UserRecord>;
  deleteUser: (id: string) => Promise<void>;
}

const normalizeAccess = (role: RbacRole, access: PageAccessKey[]): PageAccessKey[] => {
  const allowed = role === 'admin' ? ADMIN_PAGE_ACCESS : STAFF_PAGE_ACCESS;
  const unique = Array.from(new Set(access));
  return unique.filter((entry): entry is PageAccessKey => allowed.includes(entry));
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    if (!currentUser.access.includes('users')) {
      setIsUsersLoading(false);
      return;
    }

    let isMounted = true;
    setIsUsersLoading(true);
    void usersApi.list({ page, limit })
      .then((response) => {
        if (!isMounted) return;
        setUsers(response.data.map((user) => ({
          ...user,
          access: normalizeAccess(user.role, user.access),
        })));
        setTotal(response.total);
        setUserError(null);
      })
      .catch((error: unknown) => {
        if (isMounted) setUserError(error instanceof ApiError ? error.message : 'Users could not be loaded.');
      })
      .finally(() => {
        if (isMounted) setIsUsersLoading(false);
      });
    return () => { isMounted = false; };
  }, [currentUser, usersRefreshKey, page, limit]);

  const createUser = async (payload: CreateUserInput) => {
    const createdUser = await usersApi.create({
      ...payload,
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone.trim(),
      position: payload.position.trim(),
      createdAt: payload.createdAt?.trim() || undefined,
    });
    const normalizedUser = { ...createdUser, access: normalizeAccess(createdUser.role, createdUser.access) };
    setUsers((previousUsers) => [normalizedUser, ...previousUsers]);
    setUserError(null);
    return normalizedUser;
  };

  const updateUser = async (id: string, payload: UpdateUserInput) => {
    const updatedUser = await usersApi.update(id, {
      ...payload,
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone.trim(),
      position: payload.position.trim(),
      password: payload.password?.trim() || undefined,
    });
    const normalizedUser = { ...updatedUser, access: normalizeAccess(updatedUser.role, updatedUser.access) };
    setUsers((previousUsers) => previousUsers.map((user) => user.id === id ? normalizedUser : user));
    setUserError(null);
    return normalizedUser;
  };

  const deleteUser = async (id: string) => {
    await usersApi.remove(id);
    setUsers((previousUsers) => previousUsers.filter((user) => user.id !== id));
    setUserError(null);
  };

  const goToPage = (nextPage: number) => setPage(Math.max(1, nextPage));
  const refreshUsers = () => setUsersRefreshKey((value) => value + 1);

  return (
    <UserContext.Provider
      value={{
        users,
        total,
        page,
        limit,
        isUsersLoading,
        userError,
        refreshUsers,
        goToPage,
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
