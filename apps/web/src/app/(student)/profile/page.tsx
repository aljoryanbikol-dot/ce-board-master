'use client';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/auth/auth-api';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/form/form-field';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { initials } from '@/lib/utils';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{ currentPassword: string; newPassword: string }>();

  const onSubmit = handleSubmit(async (values) => {
    try { await authApi.changePassword(values.currentPassword, values.newPassword); toast.success('Password updated'); reset(); }
    catch (err) { toast.fromError(err, 'Could not update your password'); }
  });

  return (
    <div>
      <PageHeader title="Profile" description="Your account details." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <Avatar className="h-16 w-16"><AvatarFallback className="text-lg">{initials(user?.fullName || user?.email || 'CE')}</AvatarFallback></Avatar>
            <p className="mt-3 font-display font-semibold">{user?.fullName || 'Reviewer'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="mt-3 flex gap-2"><Badge variant="muted">{user?.role}</Badge><Badge>{user?.subscriptionTier}</Badge></div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField label="Current password" htmlFor="currentPassword"><Input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword')} /></FormField>
              <FormField label="New password" htmlFor="newPassword" hint="8+ chars with upper, lower, and a number"><Input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} /></FormField>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Spinner className="text-primary-foreground" /> : 'Update password'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
