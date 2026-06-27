'use client';
import { useAdminBlueprints } from '@/features/admin/hooks/use-admin';
import { ResourceTable, type Column } from '@/features/admin/components/resource-table';
import { Badge } from '@/components/ui/badge';

interface Blueprint { id?: string; publicId?: string; name?: string; status?: string; totalQuestions?: number; }
export default function BlueprintsPage() {
  const query = useAdminBlueprints();
  const rows = (query.data as Blueprint[] | undefined) ?? [];
  const columns: Column<Blueprint>[] = [
    { key: 'name', header: 'Blueprint', render: (r) => <span className="font-medium">{r.name ?? r.publicId ?? '—'}</span> },
    { key: 'q', header: 'Questions', render: (r) => <span className="font-mono">{r.totalQuestions ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'published' ? 'success' : 'muted'}>{r.status ?? 'draft'}</Badge> },
  ];
  return <ResourceTable title="Blueprint Management" description="How exams are composed across subjects and topics." isLoading={query.isLoading} isError={query.isError} rows={rows} columns={columns} rowKey={(r) => r.publicId ?? r.id ?? Math.random().toString()} />;
}
