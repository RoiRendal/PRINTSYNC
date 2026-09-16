import { ApiError } from './errors';
import { API_BASE_URL } from './baseUrl';

export interface ApiClient {
  request<TResponse>(path: string, options?: RequestInit): Promise<TResponse>;
  get<TResponse>(path: string, query?: Record<string, string | number | undefined>): Promise<TResponse>;
  post<TResponse, TBody>(path: string, body: TBody): Promise<TResponse>;
  patch<TResponse, TBody>(path: string, body: TBody): Promise<TResponse>;
  delete<TResponse = void>(path: string): Promise<TResponse>;
}

interface ApiSuccessEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: {
    message?: string;
  };
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function buildQueryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.append(key, String(value));
  }
  const string = params.toString();
  return string ? `?${string}` : '';
}

async function request<TResponse>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<TResponse> {
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

  if (allowRefresh && response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (refreshed.ok) {
      return request<TResponse>(path, options, false);
    }
  }

  if (!response.ok) {
    const errorPayload = payload as ApiErrorEnvelope | null;
    const message = errorPayload?.error?.message
      ? errorPayload.error.message
      : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccessEnvelope<TResponse>).data;
  }

  return payload as TResponse;
}

export const apiClient: ApiClient = {
  request,
  get: <TResponse>(path: string, query?: Record<string, string | number | undefined>) =>
    request<TResponse>(path + (query ? buildQueryString(query) : '')),
  post: <TResponse, TBody>(path: string, body: TBody) =>
    request<TResponse>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <TResponse, TBody>(path: string, body: TBody) =>
    request<TResponse>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <TResponse = void>(path: string) => request<TResponse>(path, { method: 'DELETE' }),
};
