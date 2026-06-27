'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/lib/auth/auth-api';
import { forgotPasswordSchema, type ForgotPasswordForm } from '../schemas';
import { FormField } from '@/components/form/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

export function ForgotPasswordFormView() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.forgotPassword(values);
      setSent(true);
    } catch (err) {
      toast.fromError(err, 'Could not send the reset link');
    }
  });

  if (sent) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1 text-muted-foreground">If an account exists for that email, a password reset link is on its way.</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
      </FormField>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Spinner className="text-primary-foreground" /> : 'Send reset link'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
