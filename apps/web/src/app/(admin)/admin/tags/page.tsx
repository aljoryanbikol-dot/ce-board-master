'use client';
import { CrudResource, type ColumnDef, type FieldDef } from '@/features/admin/components/crud-resource';
import { tagsApi, type Tag } from '@/features/admin/api/taxonomy-api';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = ['general', 'prc_exam', 'difficulty', 'topic_theme', 'skill_type', 'exam_year'];

const columns: ColumnDef<Tag>[] = [
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'slug', header: 'Slug', render: (r) => <span className="font-mono text-xs">{r.slug}</span> },
  { key: 'category', header: 'Category', render: (r) => <Badge variant="outline">{r.category}</Badge> },
  { key: 'usage', header: 'Used by', render: (r) => r._count?.questionTags ?? r.usageCount ?? 0 },
  { key: 'active', header: 'Status', render: (r) => <Badge variant={r.isActive ? 'success' : 'outline'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
];

const fields: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, colSpan: 2 },
  { name: 'slug', label: 'Slug', type: 'text', help: 'Auto-generated from name if left blank', placeholder: 'a-z, 0-9, hyphen' },
  { name: 'category', label: 'Category', type: 'select', required: true, options: CATEGORIES.map((c) => ({ value: c, label: c })) },
  { name: 'colorHex', label: 'Color', type: 'color', placeholder: '#2563eb' },
  { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
  { name: 'isActive', label: 'Active', type: 'checkbox' },
];

export default function TagsAdminPage() {
  return (
    <CrudResource<Tag>
      title="Tags"
      description="Cross-cutting labels applied to questions."
      resourceKey="tags"
      client={tagsApi}
      columns={columns}
      fields={fields}
      searchPlaceholder="Search tags…"
      toForm={(r) => ({
        name: r.name, slug: r.slug, category: r.category,
        colorHex: r.colorHex ?? '', description: r.description ?? '', isActive: r.isActive,
      })}
    />
  );
}
