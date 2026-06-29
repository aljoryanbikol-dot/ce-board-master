'use client';
/**
 * @file Learning Objectives admin (Knowledge Library consumer).
 * Read-only list (search + status filter, cursor paginated) + idempotent
 * "Sync from Library" import. Objectives are authored in the Knowledge Library,
 * not on-site. Backed by /admin/learning-objectives.
 */
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Upload, FileJson, CheckCircle2, AlertTriangle } from 'lucide-react';
import { learningObjectivesApi, type LoSyncResult } from '@/features/admin/api/learning-objectives-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const STATUSES = ['draft', 'in_review', 'approved', 'published', 'deprecated', 'archived'];
const selCls = 'rounded-lg border bg-background p-2 text-sm';
const LIMIT = 20;
const statusVariant = (s: string): 'success' | 'warning' | 'outline' =>
  s === 'published' ? 'success' : s === 'archived' || s === 'deprecated' ? 'outline' : 'warning';

export default function LearningObjectivesAdminPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [stack, setStack] = useState<string[]>([]);

  const params = { q: q || undefined, status: fStatus || undefined, cursor: cursor || undefined, limit: LIMIT };
  const listQ = useQuery({ queryKey: ['admin', 'learning-objectives', params], queryFn: () => learningObjectivesApi.list(params), placeholderData: (p) => p });
  const items = listQ.data?.data ?? [];
  const pg = listQ.data?.pagination;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'learning-objectives'] });
  const resetPaging = () => { setCursor(null); setStack([]); };

  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [syncResult, setSyncResult] = useState<LoSyncResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importMut = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { throw new Error('Invalid JSON — check the file/paste.'); }
      const arr = Array.isArray(parsed) ? parsed : (parsed as { objectives?: unknown[] })?.objectives;
      if (!Array.isArray(arr) || arr.length === 0) throw new Error('Expected a non-empty array, or an object with an "objectives" array.');
      return learningObjectivesApi.bulkImport(arr);
    },
    onSuccess: (r) => { setSyncResult(r); toast.success('Synced', `${r.created} created, ${r.updated} updated${r.failed ? `, ${r.failed} failed` : ''}.`); invalidate(); },
    onError: (e) => { setSyncResult(null); toast.fromError(e, 'Sync failed'); },
  });
  const onFile = (file?: File) => { if (!file) return; const rd = new FileReader(); rd.onload = () => setRaw(String(rd.result ?? '')); rd.readAsText(file); };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Learning Objectives</h1>
          <p className="text-sm text-muted-foreground">The syllabus backbone for grounding and blueprints. Synced from the Knowledge Library.</p>
        </div>
        <Button variant="outline" onClick={() => { setSyncResult(null); setRaw(''); setImportOpen(true); }}><Upload className="h-4 w-4" /> Sync from Library</Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <form className="relative md:col-span-2" onSubmit={(e) => { e.preventDefault(); resetPaging(); setQ(search.trim()); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search statement / public ID…" className="pl-9" />
        </form>
        <select className={selCls} value={fStatus} onChange={(e) => { setFStatus(e.target.value); resetPaging(); }} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Public ID</th>
              <th className="p-3 font-medium">Statement</th>
              <th className="p-3 font-medium">Bloom</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><Spinner /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No learning objectives yet. Sync them from the Knowledge Library.</td></tr>
            ) : items.map((lo) => (
              <tr key={lo.id} className="border-b align-top last:border-0 hover:bg-secondary/40">
                <td className="p-3 font-mono text-xs">{lo.publicId}</td>
                <td className="max-w-xl p-3"><span className="line-clamp-2">{lo.statement}</span></td>
                <td className="p-3"><Badge variant="outline">{lo.bloomLevel}</Badge></td>
                <td className="p-3"><Badge variant={statusVariant(lo.status)}>{lo.status}</Badge></td>
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

      {/* Knowledge Library sync */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) setImportOpen(false); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Sync learning objectives from the Knowledge Library</DialogTitle>
            <DialogDescription>Paste or upload a JSON export. Matching objectives (by public ID) are updated, new ones created and published — safe to re-run.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileJson className="h-4 w-4" /> Choose JSON file</Button>
              {raw ? <span className="text-xs text-muted-foreground">{raw.length.toLocaleString()} chars loaded</span> : null}
            </div>
            <textarea
              className="h-44 w-full rounded-lg border bg-background p-2 font-mono text-xs"
              placeholder={'{ "objectives": [ { "subjectCode": "STR", "topicCode": 1, "subtopicCode": 3, "sequenceNumber": 1, "statement": "Calculate normal stress in an axially loaded member.", "bloomLevel": "apply" } ] }'}
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
                    {syncResult.errors.map((er, i) => <li key={i}><span className="font-mono">{er.publicId || `#${er.index}`}</span>: {er.message}</li>)}
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
