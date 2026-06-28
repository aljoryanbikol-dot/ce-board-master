import type { ReactNode } from 'react';
import { AdminShell } from '@/components/shell/admin-shell';

// Auth-gated, per-user, live-data portal — render dynamically (never prerender).
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
