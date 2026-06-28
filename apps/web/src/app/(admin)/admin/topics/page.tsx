'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CrudResource, type ColumnDef, type FieldDef } from '@/features/admin/components/crud-resource';
import { topicsApi, subjectsApi, type Topic } from '@/features/admin/api/taxonomy-api';
import { Badge } from '@/components/ui/badge';

const columns: ColumnDef<Topic>[] = [
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: 'subject', header: 'Subject', render: (r) => r.subject?.name ?? '—' },
  { key: 'subtopics', header: 'Subcategories', render: (r) => r._count?.subtopics ?? 0 },
  { key: 'questions', header: 'Questions', render: (r) => r._count?.questions ?? 0 },
  { key: 'active', header: 'Status', render: (r) => <Badge variant={r.isActive ? 'success' : 'outline'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
];

export default function TopicsAdminPage() {
  const subjectsQ = useQuery({ queryKey: ['admin', 'subjects', 'all'], queryFn: () => subjectsApi.list({ limit: 100 }) });
  const subjectOptions = (subjectsQ.data?.items ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));
  const [filterSubject, setFilterSubject] = useState('');

  const fields: FieldDef[] = [
    { name: 'subjectId', label: 'Subject', type: 'select', required: true, options: subjectOptions, colSpan: 2 },
    { name: 'name', label: 'Name', type: 'text', required: true, colSpan: 2 },
    { name: 'code', label: 'Code', type: 'text', required: true, help: 'A–Z, 0–9, hyphen' },
    { name: 'prcWeightPercent', label: 'PRC weight %', type: 'number' },
    { name: 'sortOrder', label: 'Sort order', type: 'number' },
    { name: 'prcLearningOutcome', label: 'PRC learning outcome', type: 'textarea' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'isActive', label: 'Active', type: 'checkbox', help: 'Visible to students' },
  ];

  return (
    <CrudResource<Topic>
      title="Categories"
      description="Topics within a subject (taxonomy level 2)."
      resourceKey="topics"
      client={topicsApi}
      columns={columns}
      fields={fields}
      searchPlaceholder="Search categories…"
      listParams={{ subjectId: filterSubject || undefined }}
      createDisabled={subjectOptions.length === 0}
      createDisabledHint="Create a subject first"
      renderFilters={
        <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="rounded-lg border bg-background p-2 text-sm" aria-label="Filter by subject">
          <option value="">All subjects</option>
          {subjectOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      }
      toForm={(r) => ({
        subjectId: r.subjectId, name: r.name, code: r.code,
        prcWeightPercent: r.prcWeightPercent ?? '', sortOrder: r.sortOrder,
        prcLearningOutcome: r.prcLearningOutcome ?? '', description: r.description ?? '', isActive: r.isActive,
      })}
    />
  );
}
