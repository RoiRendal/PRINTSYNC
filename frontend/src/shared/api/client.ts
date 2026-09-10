import { ApiError } from './errors';

export interface ApiClient {
  request<TResponse>(path: string, options?: RequestInit): Promise<TResponse>;
  get<TResponse>(path: string): Promise<TResponse>;
  post<TResponse, TBody>(path: string, body: TBody): Promise<TResponse>;
  patch<TResponse, TBody>(path: string, body: TBody): Promise<TResponse>;
  delete<TResponse = void>(path: string): Promise<TResponse>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

async function request<TResponse>(path: string, options: RequestInit = {}): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    credentials: 'include',
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? String(payload.message)
      : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as TResponse;
}

export const apiClient: ApiClient = {
  request,
  get: <TResponse>(path: string) => request<TResponse>(path),
  post: <TResponse, TBody>(path: string, body: TBody) =>
    request<TResponse>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <TResponse, TBody>(path: string, body: TBody) =>
    request<TResponse>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <TResponse = void>(path: string) => request<TResponse>(path, { method: 'DELETE' }),
};
