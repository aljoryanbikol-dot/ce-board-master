import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { ForgotPasswordFormView } from '@/features/auth/components/forgot-password-form';
export const metadata: Metadata = { title: 'Forgot password' };
export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a secure reset link.">
      <ForgotPasswordFormView />
    </AuthShell>
  );
}
