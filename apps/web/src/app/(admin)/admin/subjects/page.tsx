'use client';
import { CrudResource, type ColumnDef, type FieldDef } from '@/features/admin/components/crud-resource';
import { subjectsApi, type Subject } from '@/features/admin/api/taxonomy-api';
import { Badge } from '@/components/ui/badge';

const columns: ColumnDef<Subject>[] = [
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: 'examDay', header: 'Day', render: (r) => r.examDay },
  { key: 'topics', header: 'Categories', render: (r) => r._count?.topics ?? 0 },
  { key: 'questions', header: 'Questions', render: (r) => r._count?.questions ?? 0 },
  { key: 'order', header: 'Order', render: (r) => r.sortOrder },
  { key: 'active', header: 'Status', render: (r) => <Badge variant={r.isActive ? 'success' : 'outline'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
];

const fields: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, colSpan: 2 },
  { name: 'code', label: 'Code', type: 'text', required: true, help: 'A–Z, 0–9, hyphen (e.g. STRUC)' },
  { name: 'examDay', label: 'Exam day', type: 'number', required: true, help: 'PRC board day (1 or 2)' },
  { name: 'prcWeightPercent', label: 'PRC weight %', type: 'number' },
  { name: 'sortOrder', label: 'Sort order', type: 'number' },
  { name: 'colorHex', label: 'Color (hex)', type: 'text', placeholder: '#1b4b8f' },
  { name: 'iconName', label: 'Icon name', type: 'text' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'isActive', label: 'Active', type: 'checkbox', help: 'Visible to students' },
];

export default function SubjectsAdminPage() {
  return (
    <CrudResource<Subject>
      title="Subjects"
      description="Top-level board subjects (taxonomy level 1)."
      resourceKey="subjects"
      client={subjectsApi}
      columns={columns}
      fields={fields}
      searchPlaceholder="Search subjects…"
      toForm={(r) => ({
        name: r.name, code: r.code, examDay: r.examDay,
        prcWeightPercent: r.prcWeightPercent ?? '', sortOrder: r.sortOrder,
        colorHex: r.colorHex ?? '', iconName: r.iconName ?? '', description: r.description ?? '', isActive: r.isActive,
      })}
    />
  );
}
