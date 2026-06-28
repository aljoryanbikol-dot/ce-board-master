'use client';
/**
 * @file crud-resource.tsx
 * Generic, config-driven admin CRUD screen: search + pagination + bulk-select,
 * create/edit dialog (built from a field config), and delete / bulk-delete with
 * confirmation. Powers the taxonomy screens (Subjects, Topics, Subtopics, …).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import type { ListParams, ListResult } from '../api/taxonomy-api';

export type FieldType = 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'color';
export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  colSpan?: 1 | 2;
}
export interface ColumnDef<T> { key: string; header: string; render: (row: T) => ReactNode; className?: string; }

interface CrudClient<T> {
  list: (params?: ListParams) => Promise<ListResult<T>>;
  create: (body: Record<string, unknown>) => Promise<T>;
  update: (id: string, body: Record<string, unknown>) => Promise<T>;
  remove: (id: string) => Promise<unknown>;
  bulkRemove: (ids: string[]) => Promise<unknown>;
}

interface Props<T extends { id: string }> {
  title: string;
  description?: string;
  resourceKey: string;
  client: CrudClient<T>;
  columns: ColumnDef<T>[];
  fields: FieldDef[];
  toForm: (row: T) => Record<string, unknown>;
  listParams?: ListParams;
  renderFilters?: ReactNode;
  searchPlaceholder?: string;
  /** Disable create/edit/delete (e.g. missing a required filter selection). */
  createDisabled?: boolean;
  createDisabledHint?: string;
}

const PAGE_SIZE = 20;

export function CrudResource<T extends { id: string }>(props: Props<T>) {
  const { title, description, resourceKey, client, columns, fields, toForm, listParams, renderFilters, searchPlaceholder } = props;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [confirm, setConfirm] = useState<{ kind: 'one' | 'bulk'; id?: string } | null>(null);

  const params: ListParams = { q: q || undefined, page, limit: PAGE_SIZE, ...listParams };
  const listKey = ['admin', resourceKey, params] as const;

  const query = useQuery({
    queryKey: listKey,
    queryFn: () => client.list(params),
    placeholderData: (prev) => prev,
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', resourceKey] });

  const saveMut = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      editing ? client.update(editing.id, payload) : client.create(payload),
    onSuccess: () => {
      toast.success(editing ? 'Saved' : 'Created', `${title.replace(/s$/, '')} ${editing ? 'updated' : 'created'}.`);
      setFormOpen(false); setEditing(null); invalidate();
    },
    onError: (e) => toast.fromError(e, 'Could not save'),
  });

  const deleteMut = useMutation({
    mutationFn: async (c: { kind: 'one' | 'bulk'; id?: string }) =>
      c.kind === 'one' ? client.remove(c.id as string) : client.bulkRemove([...selected]),
    onSuccess: (_d, c) => {
      toast.success('Deleted', c.kind === 'bulk' ? `${selected.size} item(s) deleted.` : 'Item deleted.');
      setConfirm(null); setSelected(new Set()); invalidate();
    },
    onError: (e) => { toast.fromError(e, 'Could not delete'); setConfirm(null); },
  });

  function openCreate() {
    const init: Record<string, unknown> = {};
    for (const f of fields) init[f.name] = f.type === 'checkbox' ? true : f.type === 'number' ? 0 : '';
    setValues(init); setEditing(null); setFormOpen(true);
  }
  function openEdit(row: T) { setValues(toForm(row)); setEditing(row); setFormOpen(true); }

  function submit() {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (f.type === 'number') payload[f.name] = v === '' || v === null || v === undefined ? undefined : Number(v);
      else if (f.type === 'checkbox') payload[f.name] = Boolean(v);
      else payload[f.name] = v === '' ? undefined : v;
    }
    saveMut.mutate(payload);
  }

  const allOnPageSelected = items.length > 0 && items.every((r) => selected.has(r.id));
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) items.forEach((r) => next.delete(r.id));
      else items.forEach((r) => next.add(r.id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const headerCols = useMemo(() => columns, [columns]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Button onClick={openCreate} disabled={props.createDisabled} title={props.createDisabled ? props.createDisabledHint : undefined}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(search.trim()); }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder ?? 'Search…'}
            className="pl-9"
          />
        </form>
        {renderFilters}
        {selected.size > 0 ? (
          <Button variant="destructive" onClick={() => setConfirm({ kind: 'bulk' })}>
            <Trash2 className="h-4 w-4" /> Delete {selected.size}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-10 p-3"><input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} aria-label="Select all" /></th>
              {headerCols.map((c) => <th key={c.key} className={`p-3 font-medium ${c.className ?? ''}`}>{c.header}</th>)}
              <th className="w-24 p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr><td colSpan={headerCols.length + 2} className="p-8 text-center text-muted-foreground"><Spinner /></td></tr>
            ) : query.isError ? (
              <tr><td colSpan={headerCols.length + 2} className="p-8 text-center text-destructive">Failed to load. Try again.</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={headerCols.length + 2} className="p-8 text-center text-muted-foreground">No records found.</td></tr>
            ) : items.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-secondary/40">
                <td className="p-3"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} aria-label="Select row" /></td>
                {headerCols.map((c) => <td key={c.key} className={`p-3 ${c.className ?? ''}`}>{c.render(row)}</td>)}
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirm({ kind: 'one', id: row.id })} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} total</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span>Page {page} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) { setFormOpen(false); setEditing(null); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${title.replace(/s$/, '')}` : `New ${title.replace(/s$/, '')}`}</DialogTitle>
            <DialogDescription>Fill in the details below. Fields marked * are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid grid-cols-2 gap-4 py-2">
            {fields.map((f) => (
              <div key={f.name} className={f.colSpan === 2 || f.type === 'textarea' ? 'col-span-2' : 'col-span-2 sm:col-span-1'}>
                <label className="mb-1 block text-sm font-medium" htmlFor={`fld-${f.name}`}>
                  {f.label}{f.required ? ' *' : ''}
                </label>
                {f.type === 'textarea' ? (
                  <textarea id={`fld-${f.name}`} value={String(values[f.name] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} placeholder={f.placeholder} rows={3} className="w-full rounded-lg border bg-background p-2 text-sm" />
                ) : f.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))} /> {f.help ?? 'Enabled'}</label>
                ) : f.type === 'select' ? (
                  <select id={`fld-${f.name}`} value={String(values[f.name] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} required={f.required} className="w-full rounded-lg border bg-background p-2 text-sm">
                    <option value="">Select…</option>
                    {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <Input id={`fld-${f.name}`} type={f.type === 'number' ? 'number' : f.type === 'color' ? 'text' : 'text'} value={String(values[f.name] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} placeholder={f.placeholder} required={f.required} />
                )}
                {f.help && f.type !== 'checkbox' ? <p className="mt-1 text-xs text-muted-foreground">{f.help}</p> : null}
              </div>
            ))}
            <DialogFooter className="col-span-2 mt-2">
              <Button type="button" variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancel</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? <Spinner className="text-primary-foreground" /> : (editing ? 'Save changes' : 'Create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
            <DialogDescription>
              {confirm?.kind === 'bulk' ? `Delete ${selected.size} selected record(s)? This can be undone by support.` : 'Delete this record? This can be undone by support.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMut.isPending} onClick={() => confirm && deleteMut.mutate(confirm)}>
              {deleteMut.isPending ? <Spinner className="text-primary-foreground" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
