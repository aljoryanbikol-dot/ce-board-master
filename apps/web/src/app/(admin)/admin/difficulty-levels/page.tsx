'use client';
import { CrudResource, type ColumnDef, type FieldDef } from '@/features/admin/components/crud-resource';
import { difficultyLevelsApi, type DifficultyLevel } from '@/features/admin/api/taxonomy-api';
import { Badge } from '@/components/ui/badge';

const columns: ColumnDef<DifficultyLevel>[] = [
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: 'threshold', header: 'Passing %', render: (r) => (r.passingThreshold != null ? String(r.passingThreshold) : '—') },
  { key: 'questions', header: 'Questions', render: (r) => r._count?.questions ?? 0 },
  { key: 'order', header: 'Order', render: (r) => r.sortOrder },
  { key: 'active', header: 'Status', render: (r) => <Badge variant={r.isActive ? 'success' : 'outline'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
];

const fields: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, colSpan: 2, placeholder: 'e.g. Foundational' },
  { name: 'code', label: 'Code (number)', type: 'number', required: true, help: 'Numeric rank, e.g. 1 = easiest' },
  { name: 'passingThreshold', label: 'Passing threshold %', type: 'number', placeholder: '70' },
  { name: 'sortOrder', label: 'Sort order', type: 'number' },
  { name: 'colorHex', label: 'Color', type: 'color', placeholder: '#16a34a' },
  { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
  { name: 'isActive', label: 'Active', type: 'checkbox' },
];

export default function DifficultyLevelsAdminPage() {
  return (
    <CrudResource<DifficultyLevel>
      title="Difficulty Levels"
      description="Grading bands questions are classified by."
      resourceKey="difficulty-levels"
      client={difficultyLevelsApi}
      columns={columns}
      fields={fields}
      searchPlaceholder="Search difficulty levels…"
      toForm={(r) => ({
        name: r.name, code: r.code, passingThreshold: r.passingThreshold ?? '',
        sortOrder: r.sortOrder, colorHex: r.colorHex ?? '', description: r.description ?? '', isActive: r.isActive,
      })}
    />
  );
}
