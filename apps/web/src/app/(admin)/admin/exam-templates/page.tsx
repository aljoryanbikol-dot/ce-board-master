'use client';
/**
 * @file Mock Exam Templates admin (Phase 3).
 * List + create/edit (with a Subject×count composition builder) + deactivate.
 * Backed by /exams/templates.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { examTemplatesApi, type ExamTemplate, type CompositionEntry } from '@/features/admin/api/exam-templates-api';
import { subjectsApi } from '@/features/admin/api/taxonomy-api';
import { difficultyApi } from '@/features/admin/api/questions-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const KINDS = ['full_board', 'subject', 'custom', 'adaptive', 'ai_generated'];
const selCls = 'rounded-lg border bg-background p-2 text-sm';

interface FormState {
  code: string; name: string; description: string; kind: string;
  durationMinutes: number; passingScore: number;
  randomizeQuestions: boolean; randomizeChoices: boolean;
  composition: CompositionEntry[];
}
const blank = (): FormState => ({
  code: '', name: '', description: '', kind: 'subject',
  durationMinutes: 180, passingScore: 70, randomizeQuestions: true, randomizeChoices: true,
  composition: [{ subjectId: '', count: 10 }],
});

export default function ExamTemplatesAdminPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const listQ = useQuery({ queryKey: ['admin', 'exam-templates'], queryFn: () => examTemplatesApi.list() });
  const subjectsQ = useQuery({ queryKey: ['admin', 'subjects', 'all'], queryFn: () => subjectsApi.list({ limit: 100 }) });
  const diffQ = useQuery({ queryKey: ['admin', 'difficulty', 'all'], queryFn: () => difficultyApi.list() });
  const templates = listQ.data ?? [];
  const subjects = subjectsQ.data?.items ?? [];
  const diffs = diffQ.data?.items ?? [];
  const subjMap = new Map(subjects.map((s) => [s.id, s.name]));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'exam-templates'] });
  const setF = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));
  const total = form.composition.reduce((s, e) => s + (Number(e.count) || 0), 0);

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        code: form.code, name: form.name, description: form.description || undefined, kind: form.kind,
        durationMinutes: Number(form.durationMinutes), passingScore: Number(form.passingScore),
        randomizeQuestions: form.randomizeQuestions, randomizeChoices: form.randomizeChoices,
        composition: form.composition.filter((e) => e.subjectId).map((e) => ({
          subjectId: e.subjectId, count: Number(e.count),
          ...(e.difficultyLevelId ? { difficultyLevelId: e.difficultyLevelId } : {}),
        })),
      };
      return editingId ? examTemplatesApi.update(editingId, body) : examTemplatesApi.create(body);
    },
    onSuccess: () => { toast.success(editingId ? 'Saved' : 'Created', `Template ${editingId ? 'updated' : 'created'}.`); setOpen(false); setEditingId(null); invalidate(); },
    onError: (e) => toast.fromError(e, 'Could not save template'),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => examTemplatesApi.remove(id),
    onSuccess: () => { toast.success('Deactivated', 'Template removed.'); setConfirmId(null); invalidate(); },
    onError: (e) => { toast.fromError(e, 'Could not delete'); setConfirmId(null); },
  });

  function openCreate() { setForm(blank()); setEditingId(null); setOpen(true); }
  function openEdit(t: ExamTemplate) {
    setEditingId(t.id);
    setForm({
      code: t.code, name: t.name, description: t.description ?? '', kind: t.kind,
      durationMinutes: t.durationMinutes, passingScore: t.passingScore,
      randomizeQuestions: t.randomizeQuestions, randomizeChoices: t.randomizeChoices,
      composition: t.composition?.length ? t.composition : [{ subjectId: '', count: 10 }],
    });
    setOpen(true);
  }

  const setRow = (i: number, patch: Partial<CompositionEntry>) =>
    setF({ composition: form.composition.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Mock Exam Templates</h1>
          <p className="text-sm text-muted-foreground">Reusable blueprints that compose exams from the published question bank.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New template</Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Kind</th>
              <th className="p-3 font-medium">Questions</th>
              <th className="p-3 font-medium">Duration</th>
              <th className="p-3 font-medium">Passing</th>
              <th className="w-28 p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground"><Spinner /></td></tr>
            ) : templates.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No templates yet.</td></tr>
            ) : templates.map((t) => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-secondary/40">
                <td className="p-3 font-mono text-xs">{t.code}</td>
                <td className="p-3 font-medium">{t.name}</td>
                <td className="p-3"><Badge variant="outline">{t.kind}</Badge></td>
                <td className="p-3">{t.totalQuestions}</td>
                <td className="p-3">{t.durationMinutes} min</td>
                <td className="p-3">{t.passingScore}%</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" title="Deactivate" onClick={() => setConfirmId(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editor */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setEditingId(null); } }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit template' : 'New template'}</DialogTitle>
            <DialogDescription>Define the blueprint; exams are generated from published questions at runtime.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div><label className="mb-1 block text-sm font-medium">Code *</label>
                <Input value={form.code} onChange={(e) => setF({ code: e.target.value })} placeholder="FULLBOARD-1" required /></div>
              <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Name *</label>
                <Input value={form.name} onChange={(e) => setF({ name: e.target.value })} required /></div>
              <div><label className="mb-1 block text-sm font-medium">Kind</label>
                <select className={`${selCls} w-full`} value={form.kind} onChange={(e) => setF({ kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
              <div><label className="mb-1 block text-sm font-medium">Duration (min)</label>
                <Input type="number" value={form.durationMinutes} onChange={(e) => setF({ durationMinutes: Number(e.target.value) })} /></div>
              <div><label className="mb-1 block text-sm font-medium">Passing %</label>
                <Input type="number" value={form.passingScore} onChange={(e) => setF({ passingScore: Number(e.target.value) })} /></div>
            </div>
            <div><label className="mb-1 block text-sm font-medium">Description</label>
              <textarea className="w-full rounded-lg border bg-background p-2 text-sm" rows={2} value={form.description} onChange={(e) => setF({ description: e.target.value })} /></div>
            <div className="flex gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.randomizeQuestions} onChange={(e) => setF({ randomizeQuestions: e.target.checked })} /> Randomize questions</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.randomizeChoices} onChange={(e) => setF({ randomizeChoices: e.target.checked })} /> Randomize choices</label>
            </div>

            <div className="rounded-lg border border-dashed p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4" /> Composition <span className="font-normal text-muted-foreground">({total} questions)</span></p>
                <Button type="button" variant="outline" size="sm" onClick={() => setF({ composition: [...form.composition, { subjectId: '', count: 10 }] })}><Plus className="h-3 w-3" /> Add subject</Button>
              </div>
              <div className="space-y-2">
                {form.composition.map((e, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-2">
                    <select className={`${selCls} col-span-6`} value={e.subjectId} onChange={(ev) => setRow(i, { subjectId: ev.target.value })} required>
                      <option value="">Select subject…</option>
                      {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <Input className="col-span-2" type="number" min={1} value={e.count} onChange={(ev) => setRow(i, { count: Number(ev.target.value) })} title="Count" />
                    <select className={`${selCls} col-span-3`} value={e.difficultyLevelId ?? ''} onChange={(ev) => setRow(i, { difficultyLevelId: ev.target.value || undefined })}>
                      <option value="">Any difficulty</option>
                      {diffs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <Button type="button" variant="ghost" size="sm" className="col-span-1" onClick={() => setF({ composition: form.composition.filter((_, j) => j !== i) })} disabled={form.composition.length === 1}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
              {subjMap.size === 0 ? <p className="mt-2 text-xs text-muted-foreground">Loading subjects…</p> : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditingId(null); }}>Cancel</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? <Spinner className="text-primary-foreground" /> : (editingId ? 'Save changes' : 'Create template')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate */}
      <Dialog open={!!confirmId} onOpenChange={(o) => { if (!o) setConfirmId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Deactivate template</DialogTitle>
            <DialogDescription>This hides the template from exam generation. Existing exams are unaffected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={delMut.isPending} onClick={() => confirmId && delMut.mutate(confirmId)}>{delMut.isPending ? <Spinner className="text-primary-foreground" /> : 'Deactivate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
