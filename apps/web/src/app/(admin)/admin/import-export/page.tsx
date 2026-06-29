'use client';
/**
 * @file Question Bank Import / Export (Phase 2).
 * Export: filtered pull of questions as a downloadable JSON file.
 * Import: upload or paste a JSON batch ({questions:[...]} or a bare array) and
 * push it through the existing /questions/bulk/import endpoint.
 */
import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Upload, FileJson, CheckCircle2, AlertTriangle } from 'lucide-react';
import { questionBulkApi, type BulkImportResult } from '@/features/admin/api/questions-api';
import { subjectsApi } from '@/features/admin/api/taxonomy-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

const STATUSES = ['', 'draft', 'in_review', 'approved', 'published', 'archived', 'flagged'];
const selCls = 'w-full rounded-lg border bg-background p-2 text-sm';

export default function ImportExportPage() {
  const subjectsQ = useQuery({ queryKey: ['admin', 'subjects', 'all'], queryFn: () => subjectsApi.list({ limit: 100 }) });
  const subjects = subjectsQ.data?.items ?? [];

  // Export state
  const [exStatus, setExStatus] = useState('');
  const [exSubject, setExSubject] = useState('');
  const [exLimit, setExLimit] = useState(1000);
  const exportMut = useMutation({
    mutationFn: () => questionBulkApi.export({ status: exStatus || undefined, subjectId: exSubject || undefined, limit: exLimit }),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify({ questions: data.questions }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `questions-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success('Exported', `${data.count} question(s) downloaded.`);
    },
    onError: (e) => toast.fromError(e, 'Export failed'),
  });

  // Import state
  const [raw, setRaw] = useState('');
  const [atomic, setAtomic] = useState(true);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importMut = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { throw new Error('Invalid JSON — check the file/paste.'); }
      const questions = Array.isArray(parsed) ? parsed : (parsed as { questions?: unknown[] })?.questions;
      if (!Array.isArray(questions) || questions.length === 0) throw new Error('Expected a non-empty array, or an object with a "questions" array.');
      return questionBulkApi.import(questions, atomic);
    },
    onSuccess: (r) => {
      setResult(r);
      if (r.failed === 0) toast.success('Imported', `${r.imported} question(s) created.`);
      else toast.success('Partially imported', `${r.imported} created, ${r.failed} failed.`);
    },
    onError: (e) => { setResult(null); toast.fromError(e, 'Import failed'); },
  });

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-semibold">Import / Export</h1>
        <p className="text-sm text-muted-foreground">Bulk-transfer questions as JSON. Imports reuse the same validation as the editor.</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Export */}
        <section className="rounded-xl border p-5">
          <div className="mb-4 flex items-center gap-2"><Download className="h-5 w-5 text-primary" /><h2 className="font-semibold">Export</h2></div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select className={selCls} value={exStatus} onChange={(e) => setExStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <select className={selCls} value={exSubject} onChange={(e) => setExSubject(e.target.value)}>
                <option value="">All subjects</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Max rows</label>
              <Input type="number" value={exLimit} min={1} max={5000} onChange={(e) => setExLimit(Number(e.target.value))} />
            </div>
            <Button onClick={() => exportMut.mutate()} disabled={exportMut.isPending} className="w-full">
              {exportMut.isPending ? <Spinner className="text-primary-foreground" /> : <><Download className="h-4 w-4" /> Export to JSON</>}
            </Button>
          </div>
        </section>

        {/* Import */}
        <section className="rounded-xl border p-5">
          <div className="mb-4 flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /><h2 className="font-semibold">Import</h2></div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileJson className="h-4 w-4" /> Choose JSON file</Button>
              {raw ? <span className="text-xs text-muted-foreground">{raw.length.toLocaleString()} chars loaded</span> : null}
            </div>
            <textarea
              className="h-44 w-full rounded-lg border bg-background p-2 font-mono text-xs"
              placeholder={'{ "questions": [ { "questionCode": "STRUC-001", "subjectId": "…", "topicId": "…", "subtopicId": "…", "difficultyLevelId": "…", "stemText": "…", "choices": [ {"letter":"A","text":"…"}, … ], "correctChoice": "A", "explanationText": "…" } ] }'}
              value={raw} onChange={(e) => setRaw(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={atomic} onChange={(e) => setAtomic(e.target.checked)} />
              Atomic (reject the whole batch if any row is invalid)
            </label>
            <Button onClick={() => importMut.mutate()} disabled={importMut.isPending || !raw.trim()} className="w-full">
              {importMut.isPending ? <Spinner className="text-primary-foreground" /> : <><Upload className="h-4 w-4" /> Import</>}
            </Button>

            {result ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" /> {result.imported} imported</span>
                  {result.failed > 0 ? <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" /> {result.failed} failed</span> : null}
                </div>
                {result.errors?.length ? (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {result.errors.map((er, i) => <li key={i}><span className="font-mono">row {er.index}</span>: {er.code} — {er.message}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
