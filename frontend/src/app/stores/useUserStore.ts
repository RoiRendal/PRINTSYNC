import { useShallow } from 'zustand/react/shallow';
import { usersApi } from '../../features/users/api/usersApi';
import type { CreateUserInput, UpdateUserInput, UserSummary } from '../../features/users/types';
import { normalizeAccess } from '../../features/users/utils/access';
import { createListStore } from '../../shared/store/createListStore';

interface UserActions {
  createUser: (payload: CreateUserInput) => Promise<UserSummary>;
  updateUser: (id: string, payload: UpdateUserInput) => Promise<UserSummary>;
  deleteUser: (id: string) => Promise<void>;
  reset: () => void;
}

/** Trims and lower-cases the fields the backend normalises anyway. */
const normalizeCreatePayload = (payload: CreateUserInput): CreateUserInput => ({
  ...payload,
  name: payload.name.trim(),
  email: payload.email.trim().toLowerCase(),
  phone: payload.phone.trim(),
  position: payload.position.trim(),
  createdAt: payload.createdAt?.trim() || undefined,
});

export const useUserStore = createListStore<UserSummary, UserActions>({
  // Access lists coming from the API are clamped to what the role allows so the
  // user-management table never renders grants a staff member cannot hold.
  list: async (query) => {
    const response = await usersApi.list(query);
    return {
      ...response,
      data: response.data.map((user) => ({ ...user, access: normalizeAccess(user.role, user.access) })),
    };
  },
  fallbackErrorMessage: 'Users could not be loaded.',

  actions: ({ snapshot, mutateItems, setError }) => ({
    createUser: async (payload) => {
      const created = await usersApi.create(normalizeCreatePayload(payload));
      const normalized = { ...created, access: normalizeAccess(created.role, created.access) };
      mutateItems((items) => [normalized, ...items]);
      setError(null);
      return normalized;
    },

    updateUser: async (id, payload) => {
      const updated = await usersApi.update(id, {
        ...payload,
        name: payload.name?.trim(),
        email: payload.email?.trim().toLowerCase(),
        phone: payload.phone?.trim(),
        position: payload.position?.trim(),
        password: payload.password?.trim() || undefined,
      });
      const normalized = { ...updated, access: normalizeAccess(updated.role, updated.access) };
      mutateItems((items) => items.map((current) => (current.id === id ? normalized : current)));
      setError(null);
      return normalized;
    },

    deleteUser: async (id) => {
      await usersApi.remove(id);
      mutateItems((items) => items.filter((current) => current.id !== id));
      setError(null);
    },

    reset: () => {
      snapshot().resetList();
    },
  }),
});

/** Drop-in replacement for the removed `UserContext`. */
export function useUserContext() {
  return useUserStore(
    useShallow((state) => ({
      users: state.items,
      total: state.total,
      page: state.page,
      limit: state.limit,
      isUsersLoading: state.isLoading,
      userError: state.error,
      refreshUsers: state.refresh,
      goToPage: state.goToPage,
      createUser: state.createUser,
      updateUser: state.updateUser,
      deleteUser: state.deleteUser,
    })),
  );
}
