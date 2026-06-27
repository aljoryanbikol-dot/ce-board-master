'use client';
import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth-store';

/** Runs a silent refresh on app boot to restore the session from the cookie. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status === 'idle') void bootstrap();
  }, [status, bootstrap]);
  return <>{children}</>;
}
