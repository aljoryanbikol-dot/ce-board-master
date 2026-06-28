'use client';
/**
 * Client wrapper for the student portal frame. Importing the nav (which holds
 * icon *components*) here keeps those non-serializable functions on the client
 * side of the boundary — the server layout passes only `children`, avoiding the
 * "Functions cannot be passed directly to Client Components" RSC error.
 */
import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/shell/app-shell';
import { studentNav } from '@/config/navigation';

export function StudentShell({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell sections={studentNav} homeHref="/dashboard">
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}
