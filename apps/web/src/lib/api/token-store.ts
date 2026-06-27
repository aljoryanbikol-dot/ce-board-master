/**
 * @file token-store.ts — in-memory access-token holder.
 *
 * The access token lives only in memory (never localStorage) to limit XSS blast
 * radius; the refresh token is an httpOnly cookie set by the backend, so the
 * browser sends it automatically on the refresh call. On hard reload the app
 * silently refreshes from the cookie to repopulate this store.
 */
let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export const tokenStore = {
  get: () => accessToken,
  set(token: string | null) {
    accessToken = token;
    listeners.forEach((l) => l(token));
  },
  clear() {
    accessToken = null;
    listeners.forEach((l) => l(null));
  },
  subscribe(listener: (token: string | null) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
