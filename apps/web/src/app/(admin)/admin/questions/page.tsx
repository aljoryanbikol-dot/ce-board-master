'use client';
import { useState } from 'react';
import { useAdminQuestions } from '@/features/admin/hooks/use-admin';
import { ResourceTable, type Column } from '@/features/admin/components/resource-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';

interface AdminQuestion { id: string; questionCode?: string; stemPreview?: string; questionStatus?: string; subjectCode?: string; }

export default function AdminQuestionsPage() {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 350);
  const query = useAdminQuestions(dq);
  const raw = query.data as { data?: AdminQuestion[] } | AdminQuestion[] | undefined;
  const rows: AdminQuestion[] = Array.isArray(raw) ? raw : raw?.data ?? [];

  const columns: Column<AdminQuestion>[] = [
    { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs">{r.questionCode ?? r.id.slice(0, 8)}</span> },
    { key: 'stem', header: 'Question', render: (r) => <span className="line-clamp-1">{r.stemPreview ?? '—'}</span> },
    { key: 'subject', header: 'Subject', render: (r) => <span className="text-muted-foreground">{r.subjectCode ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={r.questionStatus === 'published' ? 'success' : 'muted'}>{r.questionStatus ?? 'draft'}</Badge> },
  ];

  return (
    <ResourceTable
      title="Question Bank"
      description="Browse and manage the question catalog."
      action={<Input placeholder="Search questions…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />}
      isLoading={query.isLoading} isError={query.isError} rows={rows} columns={columns} rowKey={(r) => r.id}
      emptyDescription="No questions match your search."
    />
  );
}
