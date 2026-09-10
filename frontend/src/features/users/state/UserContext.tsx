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
  userError: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUsers: () => void;
  createUser: (payload: CreateUserInput) => Promise<UserRecord>;
  updateUser: (id: string, payload: UpdateUserInput) => Promise<UserRecord>;
  deleteUser: (id: string) => Promise<void>;
  canAccess: (path: string) => boolean;
  getDefaultAccess: (role: RbacRole) => PageAccessKey[];
  firstAdminId: string;
}

const normalizeAccess = (role: RbacRole, access?: PageAccessKey[]) => {
  const allowed = role === 'admin' ? ADMIN_PAGE_ACCESS : STAFF_PAGE_ACCESS;
  const candidate = access && access.length ? access : allowed;
  const unique = Array.from(new Set(candidate));
  return unique.filter((entry): entry is PageAccessKey => allowed.includes(entry));
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);

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

  useEffect(() => {
    if (!currentUser) return;
    if (!currentUser.access.includes('users')) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    void usersApi.list()
      .then((loadedUsers) => {
        if (!isMounted) return;
        setUsers(loadedUsers.map((user) => ({
          ...user,
          access: normalizeAccess(user.role, user.access),
        })));
        setUserError(null);
      })
      .catch((error: unknown) => {
        if (isMounted) setUserError(error instanceof ApiError ? error.message : 'Users could not be loaded.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, [currentUser, usersRefreshKey]);

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

  return (
    <UserContext.Provider
      value={{
        users,
        currentUser,
        isLoading,
        authError,
        userError,
        login,
        logout,
        refreshUsers: () => setUsersRefreshKey((value) => value + 1),
        createUser,
        updateUser,
        deleteUser,
        canAccess,
        getDefaultAccess,
        firstAdminId: currentUser?.id ?? '',
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
