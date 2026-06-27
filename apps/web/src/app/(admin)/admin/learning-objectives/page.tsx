'use client';
import { useAdminLearningObjectives } from '@/features/admin/hooks/use-admin';
import { ResourceTable, type Column } from '@/features/admin/components/resource-table';
import { Badge } from '@/components/ui/badge';

interface LO { id?: string; publicId?: string; statement?: string; status?: string; subjectCode?: string; }
export default function LearningObjectivesPage() {
  const query = useAdminLearningObjectives();
  const rows = (query.data as LO[] | undefined) ?? [];
  const columns: Column<LO>[] = [
    { key: 'pid', header: 'ID', render: (r) => <span className="font-mono text-xs">{r.publicId ?? r.id?.slice(0, 8)}</span> },
    { key: 'stmt', header: 'Statement', render: (r) => <span className="line-clamp-1">{r.statement ?? '—'}</span> },
    { key: 'subject', header: 'Subject', render: (r) => <span className="text-muted-foreground">{r.subjectCode ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'published' ? 'success' : 'muted'}>{r.status ?? 'draft'}</Badge> },
  ];
  return <ResourceTable title="Learning Objectives" description="The syllabus backbone for grounding and blueprints." isLoading={query.isLoading} isError={query.isError} rows={rows} columns={columns} rowKey={(r) => r.publicId ?? r.id ?? Math.random().toString()} />;
}
