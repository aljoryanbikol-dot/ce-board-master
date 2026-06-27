import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { LoginFormView } from '@/features/auth/components/login-form';
import { LoadingState } from '@/components/ui/spinner';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Welcome back. Pick up where you left off.">
      <Suspense fallback={<LoadingState />}><LoginFormView /></Suspense>
    </AuthShell>
  );
}
