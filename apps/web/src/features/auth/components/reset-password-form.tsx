'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/lib/auth/auth-api';
import { resetPasswordSchema, type ResetPasswordForm } from '../schemas';
import { FormField } from '@/components/form/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

export function ResetPasswordFormView() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    if (!token) { toast.error('This reset link is missing its token'); return; }
    try {
      await authApi.resetPassword({ token, password: values.password });
      toast.success('Password updated', 'You can now sign in with your new password.');
      router.replace('/login');
    } catch (err) {
      toast.fromError(err, 'Could not reset your password');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormField label="New password" htmlFor="password" error={errors.password?.message} hint="8+ chars with upper, lower, and a number" required>
        <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
      </FormField>
      <FormField label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
        <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
      </FormField>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Spinner className="text-primary-foreground" /> : 'Update password'}
      </Button>
    </form>
  );
}
