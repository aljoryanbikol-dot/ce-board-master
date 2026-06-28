'use client';
/**
 * @file Question Bank admin page — list/search/filter (cursor paginated) + bulk
 * delete + create/edit editor (cascading Subject→Category→Subcategory, choices
 * A–D + correct answer, explanation, difficulty, type, est time, status) with a
 * live KaTeX preview. Reuses the existing /questions API.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, CheckCircle2, Archive } from 'lucide-react';
import { questionsApi, difficultyApi, type QuestionSummary, type QuestionStatus } from '@/features/admin/api/questions-api';
import { subjectsApi, topicsApi, subtopicsApi } from '@/features/admin/api/taxonomy-api';
import { MathText } from '@/components/common/math-text';
import { MarkdownMath } from '@/components/common/markdown-math';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const STATUSES: QuestionStatus[] = ['draft', 'published', 'archived'];
const QTYPES = ['multiple_choice', 'computation', 'diagram_based'];
const BLOOM = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const LETTERS = ['A', 'B', 'C', 'D'];
const LIMIT = 20;

interface FormState {
  subjectId: string; topicId: string; subtopicId: string; questionCode: string;
  stemText: string; choices: string[]; correctChoice: string; explanationText: string;
  difficultyLevelId: string; questionType: string; bloomLevel: string;
  estSolvingTimeSec: number; prcSyllabusRef: string; keywords: string;
  learningObjective: string; boardYears: string; engineeringNotes: string; commonMistakes: string[];
  version?: number;
}
const blank = (): FormState => ({
  subjectId: '', topicId: '', subtopicId: '', questionCode: '', stemText: '',
  choices: ['', '', '', ''], correctChoice: 'A', explanationText: '',
  difficultyLevelId: '', questionType: 'multiple_choice', bloomLevel: 'apply',
  estSolvingTimeSec: 90, prcSyllabusRef: '', keywords: '',
  learningObjective: '', boardYears: '', engineeringNotes: '', commonMistakes: [],
});

const parseYears = (s: string): number[] =>
  s.split(',').map((y) => parseInt(y.trim(), 10)).filter((n) => Number.isFinite(n) && n >= 1900 && n <= 2100);

const statusVariant = (s: string): 'success' | 'outline' | 'destructive' | 'warning' =>
  s === 'published' ? 'success' : s === 'archived' ? 'outline' : s === 'flagged' ? 'destructive' : 'warning';

export default function QuestionsAdminPage() {
  const qc = useQueryClient();
  const [fSubject, setFSubject] = useState('');
  const [fTopic, setFTopic] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fDiff, setFDiff] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [stack, setStack] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);
  const [form, setForm] = useState<FormState>(blank());
  const [confirm, setConfirm] = useState<{ kind: 'one' | 'bulk'; id?: string } | null>(null);

  const subjectsQ = useQuery({ queryKey: ['admin', 'subjects', 'all'], queryFn: () => subjectsApi.list({ limit: 100 }) });
  const diffQ = useQuery({ queryKey: ['admin', 'difficulty', 'all'], queryFn: () => difficultyApi.list() });
  const subjects = subjectsQ.data?.items ?? [];
  const diffs = diffQ.data?.items ?? [];
  const subjMap = new Map(subjects.map((s) => [s.id, s.name]));
  const diffMap = new Map(diffs.map((d) => [d.id, d.name]));

  const fTopicsQ = useQuery({ queryKey: ['admin', 'topics', 'filter', fSubject], queryFn: () => topicsApi.list({ subjectId: fSubject || undefined, limit: 100 }) });
  const fTopics = fTopicsQ.data?.items ?? [];

  const formTopicsQ = useQuery({ queryKey: ['admin', 'topics', 'form', form.subjectId], queryFn: () => topicsApi.list({ subjectId: form.subjectId, limit: 100 }), enabled: !!form.subjectId });
  const formSubsQ = useQuery({ queryKey: ['admin', 'subtopics', 'form', form.topicId], queryFn: () => subtopicsApi.list({ topicId: form.topicId, limit: 100 }), enabled: !!form.topicId });

  const params = { q: q || undefined, subjectId: fSubject || undefined, topicId: fTopic || undefined, status: fStatus || undefined, difficultyLevelId: fDiff || undefined, cursor: cursor || undefined, limit: LIMIT };
  const listQ = useQuery({ queryKey: ['admin', 'questions', params], queryFn: () => questionsApi.list(params), placeholderData: (p) => p });
  const items = listQ.data?.data ?? [];
  const pg = listQ.data?.pagination;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'questions'] });
  const resetPaging = () => { setCursor(null); setStack([]); };

  const saveMut = useMutation({
    mutationFn: async () => {
      const choices = LETTERS.map((l, i) => ({ letter: l, text: form.choices[i] }));
      const keywords = form.keywords.split(',').map((k) => k.trim()).filter(Boolean);
      const mistakes = form.commonMistakes.map((m) => m.trim()).filter(Boolean);
      const intelligence = (form.engineeringNotes.trim() || mistakes.length)
        ? { engineeringNotes: form.engineeringNotes.trim() || undefined, commonMistakes: mistakes }
        : undefined;
      const pedagogy = {
        learningObjective: form.learningObjective.trim() || undefined,
        prcYearAppeared: parseYears(form.boardYears),
        prcSyllabusRef: form.prcSyllabusRef || undefined,
        ...(intelligence ? { intelligence } : {}),
      };
      if (editingId) {
        const body: Record<string, unknown> = {
          stemText: form.stemText, choices, correctChoice: form.correctChoice, explanationText: form.explanationText,
          difficultyLevelId: form.difficultyLevelId, subtopicId: form.subtopicId, questionType: form.questionType,
          bloomLevel: form.bloomLevel, estSolvingTimeSec: Number(form.estSolvingTimeSec),
          keywords, ...pedagogy, ...(form.version ? { version: form.version } : {}),
        };
        return questionsApi.update(editingId, body);
      }
      return questionsApi.create({
        questionCode: form.questionCode, subjectId: form.subjectId, topicId: form.topicId, subtopicId: form.subtopicId,
        difficultyLevelId: form.difficultyLevelId, stemText: form.stemText, choices, correctChoice: form.correctChoice,
        explanationText: form.explanationText, questionType: form.questionType, bloomLevel: form.bloomLevel,
        estSolvingTimeSec: Number(form.estSolvingTimeSec), keywords, language: 'en', ...pedagogy,
      });
    },
    onSuccess: () => { toast.success(editingId ? 'Saved' : 'Created', `Question ${editingId ? 'updated' : 'created (draft)'}.`); setOpen(false); setEditingId(null); invalidate(); },
    onError: (e) => toast.fromError(e, 'Could not save question'),
  });

  const deleteMut = useMutation({
    mutationFn: async (c: { kind: 'one' | 'bulk'; id?: string }) =>
      c.kind === 'one' ? questionsApi.remove(c.id as string) : Promise.all([...selected].map((id) => questionsApi.remove(id))),
    onSuccess: (_d, c) => { toast.success('Deleted', c.kind === 'bulk' ? `${selected.size} deleted.` : 'Question deleted.'); setConfirm(null); setSelected(new Set()); invalidate(); },
    onError: (e) => { toast.fromError(e, 'Could not delete'); setConfirm(null); },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuestionStatus }) => questionsApi.setStatus(id, status),
    onSuccess: (_d, v) => { toast.success('Status updated', `Question ${v.status}.`); invalidate(); },
    onError: (e) => toast.fromError(e, 'Could not update status'),
  });

  function openCreate() { setForm(blank()); setEditingId(null); setOpen(true); }
  async function openEdit(row: QuestionSummary) {
    setEditingId(row.id); setOpen(true); setLoadingForm(true);
    try {
      const d = await questionsApi.get(row.id);
      const byLetter = new Map(d.choices.map((c) => [c.letter, c.text]));
      setForm({
        subjectId: d.subjectId, topicId: d.topicId, subtopicId: d.subtopicId, questionCode: d.questionCode,
        stemText: d.stemText, choices: LETTERS.map((l) => byLetter.get(l) ?? ''), correctChoice: d.correctChoice,
        explanationText: d.explanationText, difficultyLevelId: d.difficultyLevelId, questionType: d.questionType,
        bloomLevel: d.bloomLevel, estSolvingTimeSec: d.estSolvingTimeSec, prcSyllabusRef: d.prcSyllabusRef ?? '',
        keywords: d.keywords?.join(', ') ?? '',
        learningObjective: d.learningObjective ?? '', boardYears: (d.prcYearAppeared ?? []).join(', '),
        engineeringNotes: d.engineeringNotes ?? '', commonMistakes: d.commonMistakes ?? [],
        version: d.currentVersion,
      });
    } catch (e) { toast.fromError(e, 'Could not load question'); setOpen(false); }
    finally { setLoadingForm(false); }
  }

  const allSel = items.length > 0 && items.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((p) => { const n = new Set(p); if (allSel) items.forEach((r) => n.delete(r.id)); else items.forEach((r) => n.add(r.id)); return n; });
  const toggleOne = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const setF = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const selCls = 'rounded-lg border bg-background p-2 text-sm';

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Question Bank</h1>
          <p className="text-sm text-muted-foreground">Author, edit, publish and organize exam questions.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New question</Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <form className="relative lg:col-span-2" onSubmit={(e) => { e.preventDefault(); resetPaging(); setQ(search.trim()); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stem / code…" className="pl-9" />
        </form>
        <select className={selCls} value={fSubject} onChange={(e) => { setFSubject(e.target.value); setFTopic(''); resetPaging(); }} aria-label="Subject">
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={selCls} value={fTopic} onChange={(e) => { setFTopic(e.target.value); resetPaging(); }} aria-label="Category" disabled={!fSubject}>
          <option value="">All categories</option>
          {fTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className={selCls} value={fStatus} onChange={(e) => { setFStatus(e.target.value); resetPaging(); }} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selCls} value={fDiff} onChange={(e) => { setFDiff(e.target.value); resetPaging(); }} aria-label="Difficulty">
          <option value="">All difficulties</option>
          {diffs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {selected.size > 0 ? (
        <div className="mt-3"><Button variant="destructive" size="sm" onClick={() => setConfirm({ kind: 'bulk' })}><Trash2 className="h-4 w-4" /> Delete {selected.size}</Button></div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-10 p-3"><input type="checkbox" checked={allSel} onChange={toggleAll} aria-label="Select all" /></th>
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Stem</th>
              <th className="p-3 font-medium">Subject</th>
              <th className="p-3 font-medium">Difficulty</th>
              <th className="p-3 font-medium">Status</th>
              <th className="w-40 p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground"><Spinner /></td></tr>
            ) : listQ.isError ? (
              <tr><td colSpan={7} className="p-8 text-center text-destructive">Failed to load.</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No questions found.</td></tr>
            ) : items.map((row) => (
              <tr key={row.id} className="border-b align-top last:border-0 hover:bg-secondary/40">
                <td className="p-3"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} aria-label="Select" /></td>
                <td className="p-3 font-mono text-xs">{row.questionCode}</td>
                <td className="max-w-md p-3"><span className="line-clamp-2 text-muted-foreground"><MathText text={row.stemText} /></span></td>
                <td className="p-3">{subjMap.get(row.subjectId) ?? '—'}</td>
                <td className="p-3">{diffMap.get(row.difficultyLevelId) ?? '—'}</td>
                <td className="p-3"><Badge variant={statusVariant(row.status)}>{row.status}</Badge></td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    {row.status !== 'published' ? (
                      <Button variant="ghost" size="sm" title="Publish" onClick={() => statusMut.mutate({ id: row.id, status: 'published' })}><CheckCircle2 className="h-4 w-4 text-success" /></Button>
                    ) : (
                      <Button variant="ghost" size="sm" title="Unpublish (archive)" onClick={() => statusMut.mutate({ id: row.id, status: 'archived' })}><Archive className="h-4 w-4" /></Button>
                    )}
                    <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" title="Delete" onClick={() => setConfirm({ kind: 'one', id: row.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{pg?.total ?? 0} total</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={stack.length === 0} onClick={() => { const s = [...stack]; const prev = s.pop() ?? null; setStack(s); setCursor(prev); }}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" disabled={!pg?.hasMore} onClick={() => { if (pg?.cursor) { setStack((s) => [...s, cursor ?? '']); setCursor(pg.cursor); } }}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setEditingId(null); } }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit question' : 'New question'}</DialogTitle>
            <DialogDescription>Supports <strong>Markdown</strong>, KaTeX (<code>$…$</code> inline, <code>$$…$$</code> block) and inline diagrams via <code>![alt](image-url)</code>.</DialogDescription>
          </DialogHeader>
          {loadingForm ? <div className="py-10 text-center"><Spinner /></div> : (
          <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Subject *</label>
                <select className={`${selCls} w-full`} value={form.subjectId} required disabled={!!editingId} onChange={(e) => setF({ subjectId: e.target.value, topicId: '', subtopicId: '' })}>
                  <option value="">Select…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Category *</label>
                <select className={`${selCls} w-full`} value={form.topicId} required disabled={!!editingId || !form.subjectId} onChange={(e) => setF({ topicId: e.target.value, subtopicId: '' })}>
                  <option value="">Select…</option>
                  {(formTopicsQ.data?.items ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Subcategory *</label>
                <select className={`${selCls} w-full`} value={form.subtopicId} required disabled={!form.topicId} onChange={(e) => setF({ subtopicId: e.target.value })}>
                  <option value="">Select…</option>
                  {(formSubsQ.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {!editingId ? (
              <div><label className="mb-1 block text-sm font-medium">Question code *</label>
                <Input value={form.questionCode} onChange={(e) => setF({ questionCode: e.target.value })} placeholder="e.g. STRUC-BEAM-021" required />
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-sm font-medium">Stem *</label>
              <textarea className="w-full rounded-lg border bg-background p-2 font-mono text-sm" rows={4} value={form.stemText} onChange={(e) => setF({ stemText: e.target.value })} required minLength={10} />
              {form.stemText ? <div className="mt-1 rounded border bg-muted/30 p-2"><span className="text-xs text-muted-foreground">Preview</span><MarkdownMath text={form.stemText} /></div> : null}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Choices * (select the correct one)</label>
              {LETTERS.map((l, i) => (
                <div key={l} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={form.correctChoice === l} onChange={() => setF({ correctChoice: l })} aria-label={`Correct ${l}`} />
                  <span className="w-5 font-mono text-sm">{l}</span>
                  <Input value={form.choices[i]} onChange={(e) => setF({ choices: form.choices.map((c, j) => (j === i ? e.target.value : c)) })} placeholder={`Choice ${l}`} required />
                </div>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Explanation *</label>
              <textarea className="w-full rounded-lg border bg-background p-2 font-mono text-sm" rows={4} value={form.explanationText} onChange={(e) => setF({ explanationText: e.target.value })} required minLength={10} />
              {form.explanationText ? <div className="mt-1 rounded border bg-muted/30 p-2"><span className="text-xs text-muted-foreground">Preview</span><MarkdownMath text={form.explanationText} /></div> : null}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div><label className="mb-1 block text-sm font-medium">Difficulty *</label>
                <select className={`${selCls} w-full`} value={form.difficultyLevelId} required onChange={(e) => setF({ difficultyLevelId: e.target.value })}>
                  <option value="">Select…</option>{diffs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div><label className="mb-1 block text-sm font-medium">Type</label>
                <select className={`${selCls} w-full`} value={form.questionType} onChange={(e) => setF({ questionType: e.target.value })}>{QTYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
              </div>
              <div><label className="mb-1 block text-sm font-medium">Bloom level</label>
                <select className={`${selCls} w-full`} value={form.bloomLevel} onChange={(e) => setF({ bloomLevel: e.target.value })}>{BLOOM.map((b) => <option key={b} value={b}>{b}</option>)}</select>
              </div>
              <div><label className="mb-1 block text-sm font-medium">Est. time (sec)</label>
                <Input type="number" value={form.estSolvingTimeSec} onChange={(e) => setF({ estSolvingTimeSec: Number(e.target.value) })} />
              </div>
              <div><label className="mb-1 block text-sm font-medium">Source / Syllabus ref</label>
                <Input value={form.prcSyllabusRef} onChange={(e) => setF({ prcSyllabusRef: e.target.value })} placeholder="optional" />
              </div>
              <div><label className="mb-1 block text-sm font-medium">Keywords (comma)</label>
                <Input value={form.keywords} onChange={(e) => setF({ keywords: e.target.value })} placeholder="beam, shear" />
              </div>
              <div><label className="mb-1 block text-sm font-medium">Board year(s)</label>
                <Input value={form.boardYears} onChange={(e) => setF({ boardYears: e.target.value })} placeholder="2019, 2022" />
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-dashed p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pedagogy &amp; engineering notes</p>
              <div>
                <label className="mb-1 block text-sm font-medium">Learning objective</label>
                <textarea className="w-full rounded-lg border bg-background p-2 text-sm" rows={2} value={form.learningObjective} onChange={(e) => setF({ learningObjective: e.target.value })} placeholder="What concept does this question assess?" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Engineering notes</label>
                <textarea className="w-full rounded-lg border bg-background p-2 font-mono text-sm" rows={3} value={form.engineeringNotes} onChange={(e) => setF({ engineeringNotes: e.target.value })} placeholder="Examiner notes, derivations, assumptions… (Markdown + KaTeX)" />
                {form.engineeringNotes ? <div className="mt-1 rounded border bg-muted/30 p-2"><span className="text-xs text-muted-foreground">Preview</span><MarkdownMath text={form.engineeringNotes} /></div> : null}
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-sm font-medium">Common mistakes</label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setF({ commonMistakes: [...form.commonMistakes, ''] })}><Plus className="h-3 w-3" /> Add</Button>
                </div>
                {form.commonMistakes.length === 0 ? <p className="text-xs text-muted-foreground">No common mistakes added.</p> : null}
                <div className="space-y-2">
                  {form.commonMistakes.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={m} onChange={(e) => setF({ commonMistakes: form.commonMistakes.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Mistake ${i + 1}`} />
                      <Button type="button" variant="ghost" size="sm" onClick={() => setF({ commonMistakes: form.commonMistakes.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditingId(null); }}>Cancel</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? <Spinner className="text-primary-foreground" /> : (editingId ? 'Save changes' : 'Create draft')}</Button>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirm delete</DialogTitle>
            <DialogDescription>{confirm?.kind === 'bulk' ? `Delete ${selected.size} question(s)?` : 'Delete this question?'} This can be undone by support.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMut.isPending} onClick={() => confirm && deleteMut.mutate(confirm)}>{deleteMut.isPending ? <Spinner className="text-primary-foreground" /> : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
