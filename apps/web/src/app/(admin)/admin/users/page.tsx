'use client';
import { useState } from 'react';
import { useAdminUsers } from '@/features/admin/hooks/use-admin';
import { ResourceTable, type Column } from '@/features/admin/components/resource-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';

interface AdminUser { id: string; email?: string; fullName?: string; role?: string; subscriptionTier?: string; isVerified?: boolean; }
export default function UsersPage() {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 350);
  const query = useAdminUsers(dq);
  const raw = query.data as { data?: AdminUser[] } | AdminUser[] | undefined;
  const rows: AdminUser[] = Array.isArray(raw) ? raw : raw?.data ?? [];
  const columns: Column<AdminUser>[] = [
    { key: 'name', header: 'User', render: (r) => <div><p className="font-medium">{r.fullName ?? '—'}</p><p className="text-xs text-muted-foreground">{r.email}</p></div> },
    { key: 'role', header: 'Role', render: (r) => <Badge variant="muted">{r.role ?? '—'}</Badge> },
    { key: 'tier', header: 'Tier', render: (r) => <Badge>{r.subscriptionTier ?? 'free'}</Badge> },
    { key: 'verified', header: 'Verified', render: (r) => <Badge variant={r.isVerified ? 'success' : 'warning'}>{r.isVerified ? 'Yes' : 'No'}</Badge> },
  ];
  return <ResourceTable title="Users" description="Manage platform members." action={<Input placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />} isLoading={query.isLoading} isError={query.isError} rows={rows} columns={columns} rowKey={(r) => r.id} />;
}
