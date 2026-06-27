'use client';
import { useAdminFormulas } from '@/features/admin/hooks/use-admin';
import { ResourceTable, type Column } from '@/features/admin/components/resource-table';

interface Formula { id: string; name?: string; expressionText?: string; subjectCode?: string; }
export default function FormulasPage() {
  const query = useAdminFormulas();
  const rows = (query.data as Formula[] | undefined) ?? [];
  const columns: Column<Formula>[] = [
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.name ?? r.id.slice(0, 8)}</span> },
    { key: 'expr', header: 'Expression', render: (r) => <span className="font-mono text-xs">{r.expressionText ?? '—'}</span> },
    { key: 'subject', header: 'Subject', render: (r) => <span className="text-muted-foreground">{r.subjectCode ?? '—'}</span> },
  ];
  return <ResourceTable title="Formula Library" description="The engineering formulas the tutor and questions draw from." isLoading={query.isLoading} isError={query.isError} rows={rows} columns={columns} rowKey={(r) => r.id} />;
}
