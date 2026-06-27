'use client';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { authApi } from '@/lib/auth/auth-api';
import { useAuthStore } from '@/stores/auth-store';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const logout = useAuthStore((s) => s.logout);
  const [mfaBusy, setMfaBusy] = useState(false);

  async function enableMfa() {
    setMfaBusy(true);
    try { const setup = await authApi.mfaSetup() as { otpauthUrl: string }; toast.success('MFA setup started', 'Scan the QR in your authenticator, then verify.'); console.info(setup.otpauthUrl); }
    catch (err) { toast.fromError(err, 'Could not start MFA setup'); }
    finally { setMfaBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Appearance, security, and sessions." />
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Choose how CE Board Master looks.</CardDescription></CardHeader>
          <CardContent className="flex items-center justify-between">
            <Label htmlFor="dark-mode">Dark mode</Label>
            <Switch id="dark-mode" checked={theme === 'dark'} onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Two-factor authentication</CardTitle><CardDescription>Add an extra layer of security to your account.</CardDescription></CardHeader>
          <CardContent><Button variant="outline" onClick={enableMfa} disabled={mfaBusy}>Set up authenticator</Button></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sessions</CardTitle><CardDescription>Sign out everywhere if you've used a shared device.</CardDescription></CardHeader>
          <CardContent className="flex gap-3">
            <Button variant="outline" onClick={async () => { await authApi.logoutAll(); toast.success('Signed out of all sessions'); await logout(); }}>Sign out all devices</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
