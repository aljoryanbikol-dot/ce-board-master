import type { ReactNode } from 'react';
import { StudentShell } from '@/components/shell/student-shell';

// Auth-gated, per-user, live-data portal — render dynamically (never prerender).
export const dynamic = 'force-dynamic';

export default function StudentLayout({ children }: { children: ReactNode }) {
  return <StudentShell>{children}</StudentShell>;
}
