'use client';
import { CrudResource, type ColumnDef, type FieldDef } from '@/features/admin/components/crud-resource';
import { referenceBooksApi, type ReferenceBook } from '@/features/admin/api/taxonomy-api';
import { Badge } from '@/components/ui/badge';

const columns: ColumnDef<ReferenceBook>[] = [
  { key: 'title', header: 'Title', render: (r) => <span className="font-medium">{r.title}{r.edition ? ` (${r.edition})` : ''}</span> },
  { key: 'publisher', header: 'Publisher', render: (r) => <span className="text-muted-foreground">{r.publisher ?? '—'}</span> },
  { key: 'year', header: 'Year', render: (r) => r.publicationYear ?? '—' },
  { key: 'cited', header: 'Cited by', render: (r) => r._count?.questionReferences ?? 0 },
  { key: 'active', header: 'Status', render: (r) => <Badge variant={r.isActive ? 'success' : 'outline'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
];

const fields: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, colSpan: 2 },
  { name: 'edition', label: 'Edition', type: 'text', placeholder: 'e.g. 3rd' },
  { name: 'publicationYear', label: 'Publication year', type: 'number', placeholder: '2018' },
  { name: 'publisher', label: 'Publisher', type: 'text', colSpan: 2 },
  { name: 'subjectArea', label: 'Subject area', type: 'text', placeholder: 'e.g. Structural' },
  { name: 'isbn13', label: 'ISBN-13', type: 'text', help: 'Exactly 13 chars' },
  { name: 'isbn10', label: 'ISBN-10', type: 'text', help: 'Exactly 10 chars' },
  { name: 'coverImageUrl', label: 'Cover image URL', type: 'text', colSpan: 2 },
  { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
  { name: 'isActive', label: 'Active', type: 'checkbox' },
];

export default function ReferencesAdminPage() {
  return (
    <CrudResource<ReferenceBook>
      title="Reference Books"
      description="The library of sources questions cite."
      resourceKey="reference-books"
      client={referenceBooksApi}
      columns={columns}
      fields={fields}
      searchPlaceholder="Search reference books…"
      toForm={(r) => ({
        title: r.title, edition: r.edition ?? '', publicationYear: r.publicationYear ?? '',
        publisher: r.publisher ?? '', subjectArea: r.subjectArea ?? '', isbn13: r.isbn13 ?? '',
        isbn10: r.isbn10 ?? '', coverImageUrl: r.coverImageUrl ?? '', description: r.description ?? '', isActive: r.isActive,
      })}
    />
  );
}
