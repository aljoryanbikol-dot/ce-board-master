import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/shell/app-shell';
import { studentNav } from '@/config/navigation';

// Auth-gated, per-user, live-data portal — render dynamically (never prerender).
export const dynamic = 'force-dynamic';

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell sections={studentNav} homeHref="/dashboard">{children}</AppShell>
    </ProtectedRoute>
  );
}
