import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { VerifyEmailView } from '@/features/auth/components/verify-email-view';
import { LoadingState } from '@/components/ui/spinner';
export const metadata: Metadata = { title: 'Verify email' };
export default function VerifyEmailPage() {
  return (
    <AuthShell title="Verify your email" subtitle="One quick step to secure your account.">
      <Suspense fallback={<LoadingState />}><VerifyEmailView /></Suspense>
    </AuthShell>
  );
}
