/**
 * @file use-auth.ts — the auth hook surface for components.
 *
 * Wraps the auth store + auth API into the actions screens need (login,
 * register, logout) and exposes the current user/status. Mutations update the
 * store on success so the shell + route guards react immediately.
 */
'use client';
import { useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/auth/auth-api';
import type { LoginInput, RegisterInput } from '@/lib/auth/types';

export function useAuth() {
  const { user, status, setUser, bootstrap, logout } = useAuthStore();

  const login = useCallback(async (input: LoginInput) => {
    const res = await authApi.login(input);
    if (!res.mfaRequired) setUser(res.user);
    return res;
  }, [setUser]);

  const register = useCallback((input: RegisterInput) => authApi.register(input), []);

  return {
    user,
    status,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading' || status === 'idle',
    login,
    register,
    logout,
    bootstrap,
    refreshMe: useCallback(async () => { const me = await authApi.me(); setUser(me); return me; }, [setUser]),
  };
}
