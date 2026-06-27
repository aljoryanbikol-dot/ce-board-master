import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/shell/app-shell';
import { adminNav } from '@/config/navigation';

// Auth-gated, per-user, live-data portal — render dynamically (never prerender).
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute adminOnly>
      <AppShell sections={adminNav} homeHref="/admin">{children}</AppShell>
    </ProtectedRoute>
  );
}
