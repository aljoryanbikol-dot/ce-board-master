'use client';
import { useAdminAiGenerations } from '@/features/admin/hooks/use-admin';
import { ResourceTable, type Column } from '@/features/admin/components/resource-table';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/lib/utils';

interface Generation { id: string; kind?: string; status?: string; createdAt?: string; }
export default function AiGenerationPage() {
  const query = useAdminAiGenerations();
  const rows = (query.data as Generation[] | undefined) ?? [];
  const columns: Column<Generation>[] = [
    { key: 'id', header: 'Batch', render: (r) => <span className="font-mono text-xs">{r.id.slice(0, 10)}</span> },
    { key: 'kind', header: 'Kind', render: (r) => <span className="text-muted-foreground">{r.kind ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'promoted' ? 'success' : r.status === 'failed' ? 'destructive' : 'muted'}>{r.status ?? 'pending'}</Badge> },
    { key: 'when', header: 'Created', render: (r) => <span className="text-muted-foreground">{r.createdAt ? timeAgo(r.createdAt) : '—'}</span> },
  ];
  return <ResourceTable title="AI Content Generation" description="Generated drafts and their validation outcomes." isLoading={query.isLoading} isError={query.isError} rows={rows} columns={columns} rowKey={(r) => r.id} />;
}
