'use client';
import { useAdminAuditLogs } from '@/features/admin/hooks/use-admin';
import { ResourceTable, type Column } from '@/features/admin/components/resource-table';
import { timeAgo } from '@/lib/utils';

interface AuditLog { id: string; action?: string; actorEmail?: string; resource?: string; createdAt?: string; }
export default function AuditLogsPage() {
  const query = useAdminAuditLogs();
  const raw = query.data as { data?: AuditLog[] } | AuditLog[] | undefined;
  const rows: AuditLog[] = Array.isArray(raw) ? raw : raw?.data ?? [];
  const columns: Column<AuditLog>[] = [
    { key: 'action', header: 'Action', render: (r) => <span className="font-mono text-xs">{r.action ?? '—'}</span> },
    { key: 'actor', header: 'Actor', render: (r) => <span className="text-muted-foreground">{r.actorEmail ?? 'system'}</span> },
    { key: 'resource', header: 'Resource', render: (r) => <span className="text-muted-foreground">{r.resource ?? '—'}</span> },
    { key: 'when', header: 'When', render: (r) => <span className="text-muted-foreground">{r.createdAt ? timeAgo(r.createdAt) : '—'}</span> },
  ];
  return <ResourceTable title="Audit Logs" description="A trail of security-relevant actions." isLoading={query.isLoading} isError={query.isError} rows={rows} columns={columns} rowKey={(r) => r.id} />;
}
