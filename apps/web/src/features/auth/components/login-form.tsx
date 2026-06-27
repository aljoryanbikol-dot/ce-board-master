'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/use-auth';
import { loginSchema, type LoginForm } from '../schemas';
import { FormField } from '@/components/form/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

export function LoginFormView() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [mfaNeeded, setMfaNeeded] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm & { mfaCode?: string }>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await login({ email: values.email, password: values.password, mfaCode: (values as { mfaCode?: string }).mfaCode });
      if (res.mfaRequired) { setMfaNeeded(true); toast.info('Enter your authenticator code to continue'); return; }
      toast.success('Welcome back');
      router.replace(params.get('next') || '/dashboard');
    } catch (err) {
      toast.fromError(err, 'Could not sign you in');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
      </FormField>
      <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
        <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
      </FormField>
      {mfaNeeded ? (
        <FormField label="Authentication code" htmlFor="mfaCode" hint="6-digit code from your authenticator app">
          <Input id="mfaCode" inputMode="numeric" maxLength={6} placeholder="123456" {...register('mfaCode')} />
        </FormField>
      ) : null}
      <div className="flex items-center justify-end">
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Spinner className="text-primary-foreground" /> : 'Sign in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New here? <Link href="/register" className="font-medium text-primary hover:underline">Create an account</Link>
      </p>
    </form>
  );
}
