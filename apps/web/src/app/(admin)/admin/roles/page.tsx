'use client';
import { useAdminRoles } from '@/features/admin/hooks/use-admin';
import { ResourceTable, type Column } from '@/features/admin/components/resource-table';
import { Badge } from '@/components/ui/badge';

interface Role { id?: string; slug?: string; name?: string; permissionCount?: number; }
export default function RolesPage() {
  const query = useAdminRoles();
  const rows = (query.data as Role[] | undefined) ?? [];
  const columns: Column<Role>[] = [
    { key: 'name', header: 'Role', render: (r) => <span className="font-medium">{r.name ?? r.slug ?? '—'}</span> },
    { key: 'slug', header: 'Slug', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.slug ?? '—'}</span> },
    { key: 'perms', header: 'Permissions', render: (r) => <Badge variant="muted">{r.permissionCount ?? 0}</Badge> },
  ];
  return <ResourceTable title="Roles" description="RBAC roles and their permission sets." isLoading={query.isLoading} isError={query.isError} rows={rows} columns={columns} rowKey={(r) => r.slug ?? r.id ?? Math.random().toString()} />;
}
