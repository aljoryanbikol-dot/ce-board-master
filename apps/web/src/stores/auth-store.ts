/**
 * @file auth-store.ts — global auth/session state (Zustand).
 *
 * Holds the current user and auth status. The access token itself lives in the
 * api token-store (memory), not here; this store mirrors *who* is logged in and
 * the bootstrap lifecycle so the UI can gate routes and render the shell.
 */
import { create } from 'zustand';
import { authApi } from '@/lib/auth/auth-api';
import { tokenStore } from '@/lib/api/token-store';
import type { AuthUser } from '@/lib/auth/types';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  setUser: (user: AuthUser | null) => void;
  /** Silent refresh on boot (httpOnly cookie → access token → me). */
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'unauthenticated' }),
  bootstrap: async () => {
    set({ status: 'loading' });
    try {
      const user = await authApi.bootstrap();
      set({ user, status: user ? 'authenticated' : 'unauthenticated' });
    } catch {
      // Backend unreachable / timeout / unexpected error: fail open to the
      // logged-out state so the app shell renders (login page) instead of
      // hanging on the loading screen indefinitely.
      set({ user: null, status: 'unauthenticated' });
    }
  },
  logout: async () => {
    await authApi.logout();
    tokenStore.clear();
    set({ user: null, status: 'unauthenticated' });
  },
}));
