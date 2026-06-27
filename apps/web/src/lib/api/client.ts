/**
 * @file client.ts — the typed fetch client for the CE Board Master API.
 *
 * Responsibilities (single source of truth for HTTP):
 *  - prefix requests with the API base, send JSON, attach the bearer token
 *  - unwrap the `{ data, meta }` success envelope → returns `data` (+ meta)
 *  - parse the `{ error }` envelope → throws a typed ApiError
 *  - on a 401, attempt a single silent refresh, then replay the request once
 *  - send credentials so the httpOnly refresh cookie flows on /auth/refresh
 *
 * No business logic lives here; feature API modules build on `api`.
 */
import { config } from '@/lib/config';
import { tokenStore } from './token-store';
import { ApiError, type ApiErrorBody, type ApiSuccess, type ApiMeta } from './types';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Skip the auth header + refresh dance (used by auth endpoints themselves). */
  skipAuth?: boolean;
  signal?: AbortSignal;
}

export interface ApiResult<T> { data: T; meta?: ApiMeta; }

let refreshInFlight: Promise<boolean> | null = null;

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${config.apiUrl}${path}`, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
  // Keep relative when apiUrl is a path (proxy mode).
  return config.apiUrl.startsWith('http') ? url.toString() : `${url.pathname}${url.search}`;
}

async function attemptRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(buildUrl('/auth/refresh'), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' } });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiSuccess<{ accessToken: string }>;
      if (json?.data?.accessToken) { tokenStore.set(json.data.accessToken); return true; }
      return false;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function parse<T>(res: Response): Promise<ApiResult<T>> {
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const body = (json as ApiErrorBody).error;
    throw new ApiError(body ?? { code: 'UNKNOWN', message: res.statusText || 'Request failed', statusCode: res.status });
  }
  const success = json as ApiSuccess<T>;
  return { data: success.data as T, meta: success.meta };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, query, skipAuth, signal } = options;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = tokenStore.get();
  if (!skipAuth && token) headers.authorization = `Bearer ${token}`;

  const doFetch = () => fetch(buildUrl(path, query), {
    method, headers, credentials: 'include', signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let res = await doFetch();

  // One silent refresh + replay on 401 (unless this is an auth call).
  if (res.status === 401 && !skipAuth) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      const newToken = tokenStore.get();
      if (newToken) headers.authorization = `Bearer ${newToken}`;
      res = await doFetch();
    } else {
      tokenStore.clear();
    }
  }

  return parse<T>(res);
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'DELETE' }),
  /** Unwrap to just the data (most call sites don't need meta). */
  data: async <T>(p: Promise<ApiResult<T>>): Promise<T> => (await p).data,
  refresh: attemptRefresh,
};
