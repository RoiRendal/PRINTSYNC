import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { PaginatedResponse } from '@printsync/shared-types';
import type { AuthResponse, CreateUserInput, LoginInput, UpdateUserInput, UserSummary } from '../types';

export function createUsersApi(client: ApiClient = apiClient) {
  return {
    session: async () => (await client.get<AuthResponse>('/auth/session')).user,
    login: async (payload: LoginInput) => (await client.post<AuthResponse, LoginInput>('/auth/login', payload)).user,
    refresh: async () => (await client.post<AuthResponse, Record<string, never>>('/auth/refresh', {})).user,
    logout: () => client.post<void, Record<string, never>>('/auth/logout', {}),
    list: (query?: { page?: number; limit?: number }) => client.get<PaginatedResponse<UserSummary>>('/users', query),
    create: (payload: CreateUserInput) => client.post<UserSummary, CreateUserInput>('/users', payload),
    update: (id: string, payload: UpdateUserInput) => client.patch<UserSummary, UpdateUserInput>(`/users/${id}`, payload),
    remove: (id: string) => client.delete<void>(`/users/${id}`),
  };
}

export const usersApi = createUsersApi();
