'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { isAdminRole } from '@/lib/auth/types';
import { LoadingState } from '@/components/ui/spinner';

export default function HomePage() {
  const router = useRouter();
  const { user, status } = useAuthStore();
  useEffect(() => {
    if (status === 'authenticated') router.replace(isAdminRole(user?.role) ? '/admin' : '/dashboard');
    else if (status === 'unauthenticated') router.replace('/login');
  }, [status, user?.role, router]);
  return <div className="grid min-h-screen place-items-center"><LoadingState label="Loading CE Board Master…" /></div>;
}
