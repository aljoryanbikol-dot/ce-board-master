'use client';
/**
 * Client wrapper for the admin portal frame. See student-shell.tsx — the nav
 * (with icon components) is imported on the client so the server layout passes
 * only `children` across the RSC boundary.
 */
import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/shell/app-shell';
import { adminNav } from '@/config/navigation';

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute adminOnly>
      <AppShell sections={adminNav} homeHref="/admin">
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}
