'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/auth/auth-api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { CheckCircle2, MailCheck } from 'lucide-react';

/** Handles both states: a token in the URL (auto-verify) and "check your inbox". */
export function VerifyEmailView() {
  const params = useSearchParams();
  const token = params.get('token');
  const email = params.get('email');
  const [state, setState] = useState<'idle' | 'verifying' | 'done' | 'error'>(token ? 'verifying' : 'idle');

  useEffect(() => {
    if (!token) return;
    authApi.verifyEmail({ token })
      .then(() => setState('done'))
      .catch(() => setState('error'));
  }, [token]);

  if (state === 'verifying') return <div className="flex items-center gap-3 text-sm text-muted-foreground"><Spinner /> Verifying your email…</div>;

  if (state === 'done') {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <p className="mt-3 font-medium">Email verified</p>
        <p className="mt-1 text-sm text-muted-foreground">Your account is ready.</p>
        <Button asChild className="mt-5 w-full"><Link href="/login">Continue to sign in</Link></Button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm">
        <p className="font-medium text-destructive">This verification link is invalid or expired</p>
        {email ? <Button variant="outline" className="mt-4" onClick={() => authApi.resendVerification(email).then(() => toast.success('Verification email sent'))}>Resend verification</Button> : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 text-center">
      <MailCheck className="mx-auto h-10 w-10 text-primary" />
      <p className="mt-3 font-medium">Check your email</p>
      <p className="mt-1 text-sm text-muted-foreground">We sent a verification link{email ? ` to ${email}` : ''}. Click it to activate your account.</p>
      {email ? <Button variant="outline" className="mt-5 w-full" onClick={() => authApi.resendVerification(email).then(() => toast.success('Verification email sent')).catch((e) => toast.fromError(e))}>Resend email</Button> : null}
      <Link href="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Back to sign in</Link>
    </div>
  );
}
