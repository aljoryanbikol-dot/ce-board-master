import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { ResetPasswordFormView } from '@/features/auth/components/reset-password-form';
import { LoadingState } from '@/components/ui/spinner';
export const metadata: Metadata = { title: 'Set a new password' };
export default function ResetPasswordPage() {
  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you don't use elsewhere.">
      <Suspense fallback={<LoadingState />}><ResetPasswordFormView /></Suspense>
    </AuthShell>
  );
}
