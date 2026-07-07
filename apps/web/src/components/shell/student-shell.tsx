'use client';
/**
 * Client wrapper for the student portal frame. Importing the nav (which holds
 * icon *components*) here keeps those non-serializable functions on the client
 * side of the boundary — the server layout passes only `children`, avoiding the
 * "Functions cannot be passed directly to Client Components" RSC error.
 */
import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/shell/app-shell';
import { studentNav } from '@/config/navigation';
import { useAuth } from '@/hooks/use-auth';
import { isAdminRole } from '@/lib/auth/types';

export function StudentShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Admins browsing the student portal get a way back to the admin portal —
  // without this the /admin URL is undiscoverable from the UI.
  const sections = isAdminRole(user?.role)
    ? [...studentNav, { label: 'Admin', items: [{ label: 'Admin Panel', href: '/admin', icon: Shield }] }]
    : studentNav;
  return (
    <ProtectedRoute>
      <AppShell sections={sections} homeHref="/dashboard">
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}
