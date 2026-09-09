import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { CreateUserInput, LoginInput, SessionUser, UpdateUserInput, UserSummary } from '../types';

export function createUsersApi(client: ApiClient = apiClient) {
  return {
    session: () => client.get<SessionUser | null>('/auth/session'),
    login: (payload: LoginInput) => client.post<SessionUser, LoginInput>('/auth/login', payload),
    logout: () => client.post<void, Record<string, never>>('/auth/logout', {}),
    list: () => client.get<UserSummary[]>('/users'),
    create: (payload: CreateUserInput) => client.post<UserSummary, CreateUserInput>('/users', payload),
    update: (id: string, payload: UpdateUserInput) => client.patch<UserSummary, UpdateUserInput>(`/users/${id}`, payload),
    remove: (id: string) => client.delete<void>(`/users/${id}`),
  };
}

export const usersApi = createUsersApi();
