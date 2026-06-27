'use client';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { isAdminRole } from '@/lib/auth/types';
import { LoadingState } from '@/components/ui/spinner';

interface ProtectedRouteProps {
  children: ReactNode;
  /** When true, only admin-capable roles may enter. */
  adminOnly?: boolean;
}

/**
 * Client route guard. While the session bootstraps we show a loading state;
 * unauthenticated users are redirected to /login; non-admins are bounced from
 * admin-only areas. (Server middleware adds a coarse cookie gate too.)
 */
export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, status } = useAuthStore();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    } else if (status === 'authenticated' && adminOnly && !isAdminRole(user?.role)) {
      router.replace('/dashboard');
    }
  }, [status, adminOnly, user?.role, router]);

  if (status === 'idle' || status === 'loading') return <LoadingState label="Restoring your session…" />;
  if (status === 'unauthenticated') return <LoadingState label="Redirecting to sign in…" />;
  if (adminOnly && !isAdminRole(user?.role)) return <LoadingState label="Checking access…" />;
  return <>{children}</>;
}
