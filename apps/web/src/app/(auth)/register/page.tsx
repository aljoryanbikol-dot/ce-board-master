import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { RegisterFormView } from '@/features/auth/components/register-form';
export const metadata: Metadata = { title: 'Create account' };
export default function RegisterPage() {
  return (
    <AuthShell title="Create your account" subtitle="Start your CE board review in minutes.">
      <RegisterFormView />
    </AuthShell>
  );
}
