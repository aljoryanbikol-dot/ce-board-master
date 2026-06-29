'use client';
/**
 * @file Formula Library admin (Knowledge Library).
 * List (cursor paginated) + create/edit editor with KaTeX expression preview and
 * a variables builder. Feeds the question editor and the AI Tutor grounding.
 * Backed by /admin/formulas.
 */
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Sigma, Upload, FileJson, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formulasApi, type Formula, type FormulaVariable, type FormulaSyncResult } from '@/features/admin/api/formulas-api';
import { subjectsApi, topicsApi } from '@/features/admin/api/taxonomy-api';
import { MathText } from '@/components/common/math-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const selCls = 'rounded-lg border bg-background p-2 text-sm';
const LIMIT = 20;

interface FormState {
  name: string; subjectId: string; topicId: string; unitsSystem: string;
  expressionLatex: string; expressionText: string;
  variables: FormulaVariable[];
  derivation: string; limitations: string; exampleProblem: string;
  typicalApplications: string; assumptions: string;
}
const blank = (): FormState => ({
  name: '', subjectId: '', topicId: '', unitsSystem: 'SI',
  expressionLatex: '', expressionText: '', variables: [{ symbol: '', name: '', unit: '', description: '' }],
  derivation: '', limitations: '', exampleProblem: '', typicalApplications: '', assumptions: '',
});

export default function FormulasAdminPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [fSubject, setFSubject] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [stack, setStack] = useState<string[]>([]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);
  const [form, setForm] = useState<FormState>(blank());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const subjectsQ = useQuery({ queryKey: ['admin', 'subjects', 'all'], queryFn: () => subjectsApi.list({ limit: 100 }) });
  const subjects = subjectsQ.data?.items ?? [];
  const subjMap = new Map(subjects.map((s) => [s.id, s.name]));
  const formTopicsQ = useQuery({ queryKey: ['admin', 'topics', 'form', form.subjectId], queryFn: () => topicsApi.list({ subjectId: form.subjectId, limit: 100 }), enabled: !!form.subjectId });

  const params = { q: q || undefined, subjectId: fSubject || undefined, cursor: cursor || undefined, limit: LIMIT };
  const listQ = useQuery({ queryKey: ['admin', 'formulas', params], queryFn: () => formulasApi.list(params), placeholderData: (p) => p });
  const formulas = listQ.data?.data ?? [];
  const pg = listQ.data?.pagination;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'formulas'] });
  const resetPaging = () => { setCursor(null); setStack([]); };
  const setF = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));
  const toArr = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name, subjectId: form.subjectId,
        ...(form.topicId ? { topicId: form.topicId } : {}),
        expressionText: form.expressionText, expressionLatex: form.expressionLatex,
        unitsSystem: form.unitsSystem || 'SI',
        variables: form.variables.filter((v) => v.symbol && v.name).map((v) => ({
          symbol: v.symbol, name: v.name, ...(v.unit ? { unit: v.unit } : {}), ...(v.description ? { description: v.description } : {}),
        })),
        derivation: form.derivation || undefined, limitations: form.limitations || undefined,
        exampleProblem: form.exampleProblem || undefined,
        typicalApplications: toArr(form.typicalApplications), assumptions: toArr(form.assumptions),
      };
      return editingId ? formulasApi.update(editingId, body) : formulasApi.create(body);
    },
    onSuccess: () => { toast.success(editingId ? 'Saved' : 'Created', `Formula ${editingId ? 'updated' : 'added'}.`); setOpen(false); setEditingId(null); invalidate(); },
    onError: (e) => toast.fromError(e, 'Could not save formula'),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => formulasApi.remove(id),
    onSuccess: () => { toast.success('Deactivated', 'Formula removed.'); setConfirmId(null); invalidate(); },
    onError: (e) => { toast.fromError(e, 'Could not delete'); setConfirmId(null); },
  });

  // Knowledge Library sync (import)
  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [syncResult, setSyncResult] = useState<FormulaSyncResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importMut = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { throw new Error('Invalid JSON — check the file/paste.'); }
      const items = Array.isArray(parsed) ? parsed : (parsed as { formulas?: unknown[] })?.formulas;
      if (!Array.isArray(items) || items.length === 0) throw new Error('Expected a non-empty array, or an object with a "formulas" array.');
      return formulasApi.bulkImport(items);
    },
    onSuccess: (r) => { setSyncResult(r); toast.success('Synced', `${r.created} created, ${r.updated} updated${r.failed ? `, ${r.failed} failed` : ''}.`); invalidate(); },
    onError: (e) => { setSyncResult(null); toast.fromError(e, 'Sync failed'); },
  });
  const onFile = (file?: File) => { if (!file) return; const rd = new FileReader(); rd.onload = () => setRaw(String(rd.result ?? '')); rd.readAsText(file); };

  function openCreate() { setForm(blank()); setEditingId(null); setOpen(true); }
  async function openEdit(row: Formula) {
    setEditingId(row.id); setOpen(true); setLoadingForm(true);
    try {
      const d = await formulasApi.get(row.id);
      setForm({
        name: d.name, subjectId: d.subjectId, topicId: d.topicId ?? '', unitsSystem: d.unitsSystem,
        expressionLatex: d.expressionLatex, expressionText: d.expressionText,
        variables: d.variables?.length ? d.variables : [{ symbol: '', name: '', unit: '', description: '' }],
        derivation: d.derivation ?? '', limitations: d.limitations ?? '', exampleProblem: d.exampleProblem ?? '',
        typicalApplications: (d.typicalApplications ?? []).join(', '), assumptions: (d.assumptions ?? []).join(', '),
      });
    } catch (e) { toast.fromError(e, 'Could not load formula'); setOpen(false); }
    finally { setLoadingForm(false); }
  }

  const setVar = (i: number, patch: Partial<FormulaVariable>) =>
    setF({ variables: form.variables.map((v, j) => (j === i ? { ...v, ...patch } : v)) });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Formula Library</h1>
          <p className="text-sm text-muted-foreground">Engineering formulas the question editor and AI Tutor draw from. Synced from the Knowledge Library.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setSyncResult(null); setRaw(''); setImportOpen(true); }}><Upload className="h-4 w-4" /> Sync from Library</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> New formula</Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <form className="relative md:col-span-2" onSubmit={(e) => { e.preventDefault(); resetPaging(); setQ(search.trim()); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search formulas…" className="pl-9" />
        </form>
        <select className={selCls} value={fSubject} onChange={(e) => { setFSubject(e.target.value); resetPaging(); }} aria-label="Subject">
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Expression</th>
              <th className="p-3 font-medium">Subject</th>
              <th className="p-3 font-medium">Status</th>
              <th className="w-24 p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground"><Spinner /></td></tr>
            ) : formulas.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No formulas yet.</td></tr>
            ) : formulas.map((f) => (
              <tr key={f.id} className="border-b align-top last:border-0 hover:bg-secondary/40">
                <td className="p-3 font-medium">{f.name}</td>
                <td className="max-w-xs p-3">{f.expressionLatex ? <MathText text={`$${f.expressionLatex}$`} /> : <span className="font-mono text-xs">{f.expressionText}</span>}</td>
                <td className="p-3">{subjMap.get(f.subjectId) ?? '—'}</td>
                <td className="p-3"><Badge variant={f.isActive ? 'success' : 'outline'}>{f.isActive ? 'Active' : 'Inactive'}</Badge></td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" title="Deactivate" onClick={() => setConfirmId(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{pg?.total != null ? `${pg.total} total` : ''}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={stack.length === 0} onClick={() => { const s = [...stack]; const prev = s.pop() ?? null; setStack(s); setCursor(prev); }}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" disabled={!pg?.hasMore} onClick={() => { if (pg?.cursor) { setStack((s) => [...s, cursor ?? '']); setCursor(pg.cursor); } }}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Editor */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setEditingId(null); } }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit formula' : 'New formula'}</DialogTitle>
            <DialogDescription>Enter the expression as KaTeX (e.g. <code>{'\\sigma = \\frac{F}{A}'}</code>).</DialogDescription>
          </DialogHeader>
          {loadingForm ? <div className="py-10 text-center"><Spinner /></div> : (
          <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2"><label className="mb-1 block text-sm font-medium">Name *</label>
                <Input value={form.name} onChange={(e) => setF({ name: e.target.value })} required minLength={3} /></div>
              <div><label className="mb-1 block text-sm font-medium">Subject *</label>
                <select className={`${selCls} w-full`} value={form.subjectId} required onChange={(e) => setF({ subjectId: e.target.value, topicId: '' })}>
                  <option value="">Select…</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              <div><label className="mb-1 block text-sm font-medium">Topic</label>
                <select className={`${selCls} w-full`} value={form.topicId} disabled={!form.subjectId} onChange={(e) => setF({ topicId: e.target.value })}>
                  <option value="">None</option>{(formTopicsQ.data?.items ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select></div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Expression (KaTeX) *</label>
              <Input value={form.expressionLatex} onChange={(e) => setF({ expressionLatex: e.target.value })} placeholder="\sigma = \frac{F}{A}" className="font-mono" required />
              {form.expressionLatex ? <div className="mt-1 rounded border bg-muted/30 p-2 text-center"><MathText text={`$$${form.expressionLatex}$$`} /></div> : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-3"><label className="mb-1 block text-sm font-medium">Plain-text expression *</label>
                <Input value={form.expressionText} onChange={(e) => setF({ expressionText: e.target.value })} placeholder="sigma = F / A" required /></div>
              <div><label className="mb-1 block text-sm font-medium">Units</label>
                <select className={`${selCls} w-full`} value={form.unitsSystem} onChange={(e) => setF({ unitsSystem: e.target.value })}>
                  <option value="SI">SI</option><option value="Imperial">Imperial</option><option value="Both">Both</option>
                </select></div>
            </div>

            {/* Variables */}
            <div className="rounded-lg border border-dashed p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold"><Sigma className="h-4 w-4" /> Variables</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setF({ variables: [...form.variables, { symbol: '', name: '', unit: '', description: '' }] })}><Plus className="h-3 w-3" /> Add</Button>
              </div>
              <div className="space-y-2">
                {form.variables.map((v, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-2">
                    <Input className="col-span-2" value={v.symbol} onChange={(e) => setVar(i, { symbol: e.target.value })} placeholder="σ" />
                    <Input className="col-span-4" value={v.name} onChange={(e) => setVar(i, { name: e.target.value })} placeholder="Normal stress" />
                    <Input className="col-span-2" value={v.unit ?? ''} onChange={(e) => setVar(i, { unit: e.target.value })} placeholder="MPa" />
                    <Input className="col-span-3" value={v.description ?? ''} onChange={(e) => setVar(i, { description: e.target.value })} placeholder="desc" />
                    <Button type="button" variant="ghost" size="sm" className="col-span-1" onClick={() => setF({ variables: form.variables.filter((_, j) => j !== i) })} disabled={form.variables.length === 1}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-sm font-medium">Typical applications (comma)</label>
                <Input value={form.typicalApplications} onChange={(e) => setF({ typicalApplications: e.target.value })} placeholder="beam design, columns" /></div>
              <div><label className="mb-1 block text-sm font-medium">Assumptions (comma)</label>
                <Input value={form.assumptions} onChange={(e) => setF({ assumptions: e.target.value })} placeholder="linear-elastic, small strain" /></div>
            </div>
            <div><label className="mb-1 block text-sm font-medium">Derivation</label>
              <textarea className="w-full rounded-lg border bg-background p-2 text-sm" rows={2} value={form.derivation} onChange={(e) => setF({ derivation: e.target.value })} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-sm font-medium">Limitations</label>
                <textarea className="w-full rounded-lg border bg-background p-2 text-sm" rows={2} value={form.limitations} onChange={(e) => setF({ limitations: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium">Example problem</label>
                <textarea className="w-full rounded-lg border bg-background p-2 text-sm" rows={2} value={form.exampleProblem} onChange={(e) => setF({ exampleProblem: e.target.value })} /></div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditingId(null); }}>Cancel</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? <Spinner className="text-primary-foreground" /> : (editingId ? 'Save changes' : 'Create formula')}</Button>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm */}
      <Dialog open={!!confirmId} onOpenChange={(o) => { if (!o) setConfirmId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Deactivate formula</DialogTitle>
            <DialogDescription>This removes it from the library and tutor grounding.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={delMut.isPending} onClick={() => confirmId && delMut.mutate(confirmId)}>{delMut.isPending ? <Spinner className="text-primary-foreground" /> : 'Deactivate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Knowledge Library sync */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) setImportOpen(false); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Sync formulas from the Knowledge Library</DialogTitle>
            <DialogDescription>Paste or upload a JSON export. Matching formulas (by name) are updated, new ones created — safe to re-run.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileJson className="h-4 w-4" /> Choose JSON file</Button>
              {raw ? <span className="text-xs text-muted-foreground">{raw.length.toLocaleString()} chars loaded</span> : null}
            </div>
            <textarea
              className="h-44 w-full rounded-lg border bg-background p-2 font-mono text-xs"
              placeholder={'{ "formulas": [ { "name": "Normal Stress", "subjectId": "…", "expressionText": "sigma = F/A", "expressionLatex": "\\sigma = \\frac{F}{A}", "variables": [ {"symbol":"σ","name":"Normal stress","unit":"MPa"} ] } ] }'}
              value={raw} onChange={(e) => setRaw(e.target.value)}
            />
            {syncResult ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" /> {syncResult.created} created · {syncResult.updated} updated</span>
                  {syncResult.failed > 0 ? <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" /> {syncResult.failed} failed</span> : null}
                </div>
                {syncResult.errors?.length ? (
                  <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {syncResult.errors.map((er, i) => <li key={i}><span className="font-mono">#{er.index}</span> {er.name}: {er.message}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
            <Button disabled={importMut.isPending || !raw.trim()} onClick={() => importMut.mutate()}>{importMut.isPending ? <Spinner className="text-primary-foreground" /> : <><Upload className="h-4 w-4" /> Sync</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
