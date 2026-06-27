'use client';
import { useAdminPermissions } from '@/features/admin/hooks/use-admin';
import { ResourceTable, type Column } from '@/features/admin/components/resource-table';

interface Permission { id?: string; slug?: string; description?: string; resource?: string; }
export default function PermissionsPage() {
  const query = useAdminPermissions();
  const rows = (query.data as Permission[] | undefined) ?? [];
  const columns: Column<Permission>[] = [
    { key: 'slug', header: 'Permission', render: (r) => <span className="font-mono text-xs">{r.slug ?? '—'}</span> },
    { key: 'resource', header: 'Resource', render: (r) => <span className="text-muted-foreground">{r.resource ?? '—'}</span> },
    { key: 'desc', header: 'Description', render: (r) => <span className="line-clamp-1 text-muted-foreground">{r.description ?? '—'}</span> },
  ];
  return <ResourceTable title="Permissions" description="The granular permissions roles are built from." isLoading={query.isLoading} isError={query.isError} rows={rows} columns={columns} rowKey={(r) => r.slug ?? r.id ?? Math.random().toString()} />;
}
