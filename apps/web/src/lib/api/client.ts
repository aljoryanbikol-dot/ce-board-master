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
  /** Per-request timeout in ms. Defaults to DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
}

export interface ApiResult<T> { data: T; meta?: ApiMeta; }

/**
 * Default per-request timeout (ms). Guards against the UI hanging forever when
 * the backend is unreachable (e.g. not yet deployed, cold start, network drop).
 * Override per-call via `timeoutMs`, or pass an explicit `signal` to opt out.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

let refreshInFlight: Promise<boolean> | null = null;

/** Combine an optional caller signal with an internal timeout signal. */
function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
  const cancel = () => clearTimeout(timer);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return { signal: controller.signal, cancel };
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${config.apiUrl}${path}`, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
  // Keep relative when apiUrl is a path (proxy mode).
  return config.apiUrl.startsWith('http') ? url.toString() : `${url.pathname}${url.search}`;
}

async function attemptRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const { signal, cancel } = withTimeout(undefined, DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(buildUrl('/auth/refresh'), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, signal });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiSuccess<{ accessToken: string }>;
      if (json?.data?.accessToken) { tokenStore.set(json.data.accessToken); return true; }
      return false;
    } catch {
      // Timeout or network error (backend down) → treat as "not refreshed".
      return false;
    } finally {
      cancel();
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
  const { method = 'GET', body, query, skipAuth, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = tokenStore.get();
  if (!skipAuth && token) headers.authorization = `Bearer ${token}`;

  const doFetch = () => {
    const { signal: timedSignal, cancel } = withTimeout(signal, timeoutMs);
    return fetch(buildUrl(path, query), {
      method, headers, credentials: 'include', signal: timedSignal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).finally(cancel);
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch (err) {
    // Timeout or network failure (backend down/unreachable). Surface a typed,
    // non-hanging error the UI can handle instead of a rejected raw fetch.
    const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
    throw new ApiError({
      code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: isTimeout
        ? 'The server took too long to respond. Please try again.'
        : 'Unable to reach the server. Please check your connection and try again.',
      statusCode: 0,
    });
  }

  // One silent refresh + replay on 401 (unless this is an auth call).
  if (res.status === 401 && !skipAuth) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      const newToken = tokenStore.get();
      if (newToken) headers.authorization = `Bearer ${newToken}`;
      try {
        res = await doFetch();
      } catch {
        throw new ApiError({ code: 'NETWORK_ERROR', message: 'Unable to reach the server.', statusCode: 0 });
      }
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
