'use client';
import { useAdminKnowledge } from '@/features/admin/hooks/use-admin';
import { ResourceTable, type Column } from '@/features/admin/components/resource-table';
import { Badge } from '@/components/ui/badge';

interface Doc { id: string; title?: string; documentType?: string; status?: string; }
export default function KnowledgePage() {
  const query = useAdminKnowledge();
  const rows = (query.data as Doc[] | undefined) ?? [];
  const columns: Column<Doc>[] = [
    { key: 'title', header: 'Title', render: (r) => <span>{r.title ?? r.id.slice(0, 8)}</span> },
    { key: 'type', header: 'Type', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.documentType ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'published' ? 'success' : 'muted'}>{r.status ?? 'draft'}</Badge> },
  ];
  return <ResourceTable title="Knowledge Base" description="Authoring references and standards." isLoading={query.isLoading} isError={query.isError} rows={rows} columns={columns} rowKey={(r) => r.id} />;
}
