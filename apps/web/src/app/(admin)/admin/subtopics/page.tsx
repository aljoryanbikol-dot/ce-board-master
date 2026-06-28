'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CrudResource, type ColumnDef, type FieldDef } from '@/features/admin/components/crud-resource';
import { subtopicsApi, topicsApi, type Subtopic } from '@/features/admin/api/taxonomy-api';
import { Badge } from '@/components/ui/badge';

const columns: ColumnDef<Subtopic>[] = [
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: 'topic', header: 'Category', render: (r) => r.topic?.name ?? '—' },
  { key: 'subject', header: 'Subject', render: (r) => r.topic?.subject?.name ?? '—' },
  { key: 'questions', header: 'Questions', render: (r) => r._count?.questions ?? 0 },
  { key: 'active', header: 'Status', render: (r) => <Badge variant={r.isActive ? 'success' : 'outline'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
];

export default function SubtopicsAdminPage() {
  const topicsQ = useQuery({ queryKey: ['admin', 'topics', 'all'], queryFn: () => topicsApi.list({ limit: 100 }) });
  const topicOptions = (topicsQ.data?.items ?? []).map((t) => ({ value: t.id, label: `${t.subject?.name ? t.subject.name + ' › ' : ''}${t.name} (${t.code})` }));
  const [filterTopic, setFilterTopic] = useState('');

  const fields: FieldDef[] = [
    { name: 'topicId', label: 'Category (Topic)', type: 'select', required: true, options: topicOptions, colSpan: 2 },
    { name: 'name', label: 'Name', type: 'text', required: true, colSpan: 2 },
    { name: 'code', label: 'Code', type: 'text', required: true, help: 'A–Z, 0–9, hyphen' },
    { name: 'sortOrder', label: 'Sort order', type: 'number' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'isActive', label: 'Active', type: 'checkbox', help: 'Visible to students' },
  ];

  return (
    <CrudResource<Subtopic>
      title="Subcategories"
      description="Subtopics within a category (taxonomy level 3)."
      resourceKey="subtopics"
      client={subtopicsApi}
      columns={columns}
      fields={fields}
      searchPlaceholder="Search subcategories…"
      listParams={{ topicId: filterTopic || undefined }}
      createDisabled={topicOptions.length === 0}
      createDisabledHint="Create a category first"
      renderFilters={
        <select value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)} className="rounded-lg border bg-background p-2 text-sm" aria-label="Filter by category">
          <option value="">All categories</option>
          {topicOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      }
      toForm={(r) => ({
        topicId: r.topicId, name: r.name, code: r.code,
        sortOrder: r.sortOrder, description: r.description ?? '', isActive: r.isActive,
      })}
    />
  );
}
