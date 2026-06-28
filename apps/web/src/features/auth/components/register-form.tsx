'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/use-auth';
import { registerSchema, type RegisterForm } from '../schemas';
import { FormField } from '@/components/form/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

export function RegisterFormView() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerUser({ email: values.email, password: values.password, fullName: values.fullName });
      toast.success('Account created', 'Check your email to verify your address.');
      router.replace(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      toast.fromError(err, 'Could not create your account');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormField label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
        <Input id="fullName" autoComplete="name" placeholder="Juan dela Cruz" {...register('fullName')} />
      </FormField>
      <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
      </FormField>
      <FormField label="Password" htmlFor="password" error={errors.password?.message} hint="8+ chars with uppercase, lowercase, a number & a special character" required>
        <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
      </FormField>
      <FormField label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
        <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
      </FormField>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Spinner className="text-primary-foreground" /> : 'Create account'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
