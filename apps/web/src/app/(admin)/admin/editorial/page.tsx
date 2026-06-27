'use client';
import { useAdminEditorial } from '@/features/admin/hooks/use-admin';
import { ResourceTable, type Column } from '@/features/admin/components/resource-table';
import { Badge } from '@/components/ui/badge';

interface ReviewItem { id: string; questionCode?: string; stage?: string; assignedTo?: string; status?: string; }
export default function EditorialPage() {
  const query = useAdminEditorial();
  const rows = (query.data as ReviewItem[] | undefined) ?? [];
  const columns: Column<ReviewItem>[] = [
    { key: 'code', header: 'Question', render: (r) => <span className="font-mono text-xs">{r.questionCode ?? r.id.slice(0, 8)}</span> },
    { key: 'stage', header: 'Stage', render: (r) => <Badge variant="muted">{r.stage ?? '—'}</Badge> },
    { key: 'assignee', header: 'Assignee', render: (r) => <span className="text-muted-foreground">{r.assignedTo ?? 'Unassigned'}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'completed' ? 'success' : 'warning'}>{r.status ?? 'pending'}</Badge> },
  ];
  return <ResourceTable title="Editorial Review" description="The multi-stage approval queue." isLoading={query.isLoading} isError={query.isError} rows={rows} columns={columns} rowKey={(r) => r.id} emptyTitle="Queue is clear" emptyDescription="No items are waiting for review." />;
}
