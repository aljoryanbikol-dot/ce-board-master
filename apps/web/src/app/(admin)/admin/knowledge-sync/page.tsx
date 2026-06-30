'use client';
/**
 * @file Knowledge Sync hub — one screen to sync every educational content type
 * from the Cowork Knowledge Library. Generic engine: pick a type, paste/upload a
 * JSON export, sync (idempotent upsert + version history + atomic rollback), and
 * read the sync report. The website only consumes; the Library is source of truth.
 */
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileJson, CheckCircle2, AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { knowledgeSyncApi, type SyncReport } from '@/features/admin/api/knowledge-sync-api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

const selCls = 'w-full rounded-lg border bg-background p-2 text-sm';

export default function KnowledgeSyncPage() {
  const qc = useQueryClient();
  const kindsQ = useQuery({ queryKey: ['admin', 'sync', 'kinds'], queryFn: () => knowledgeSyncApi.kinds() });
  const kinds = kindsQ.data ?? [];
  const [kind, setKind] = useState('');
  const activeKind = kind || kinds[0]?.kind || '';

  const [raw, setRaw] = useState('');
  const [atomic, setAtomic] = useState(true);
  const [report, setReport] = useState<SyncReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const countQ = useQuery({
    queryKey: ['admin', 'sync', 'count', activeKind],
    queryFn: () => knowledgeSyncApi.listItems(activeKind, { limit: 1 }),
    enabled: !!activeKind,
  });

  const syncMut = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { throw new Error('Invalid JSON — check the file/paste.'); }
      const items = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown[] })?.items;
      if (!Array.isArray(items) || items.length === 0) throw new Error('Expected a non-empty array, or an object with an "items" array.');
      return knowledgeSyncApi.sync(activeKind, items, atomic);
    },
    onSuccess: (r) => {
      setReport(r);
      const parts = [`${r.created} created`, `${r.updated} updated`, `${r.unchanged} unchanged`, r.failed ? `${r.failed} failed` : ''].filter(Boolean);
      toast.success(r.failed ? 'Synced with errors' : 'Synced', parts.join(' · ') + '.');
      qc.invalidateQueries({ queryKey: ['admin', 'sync', 'count', activeKind] });
    },
    onError: (e) => { setReport(null); toast.fromError(e, 'Sync failed'); },
  });

  const onFile = (file?: File) => { if (!file) return; const rd = new FileReader(); rd.onload = () => setRaw(String(rd.result ?? '')); rd.readAsText(file); };

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-semibold">Knowledge Sync</h1>
        <p className="text-sm text-muted-foreground">Consume educational content from the CE Board Master Knowledge Library. Idempotent: matching items update in place, never duplicate.</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,360px]">
        <section className="rounded-xl border p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Content type</label>
              <select className={selCls} value={activeKind} onChange={(e) => { setKind(e.target.value); setReport(null); }}>
                {kinds.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <span className="text-sm text-muted-foreground"><Database className="mr-1 inline h-4 w-4" />{countQ.data?.total ?? 0} currently synced</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileJson className="h-4 w-4" /> Choose JSON file</Button>
            {raw ? <span className="text-xs text-muted-foreground">{raw.length.toLocaleString()} chars loaded</span> : null}
          </div>
          <textarea
            className="mt-3 h-64 w-full rounded-lg border bg-background p-2 font-mono text-xs"
            placeholder={'{ "items": [ { "publicId": "…", … } ] }  — or a bare [ … ] array'}
            value={raw} onChange={(e) => setRaw(e.target.value)}
          />
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={atomic} onChange={(e) => setAtomic(e.target.checked)} />
            Atomic (roll back the entire batch if any row fails)
          </label>
          <Button className="mt-3 w-full" disabled={syncMut.isPending || !raw.trim() || !activeKind} onClick={() => syncMut.mutate()}>
            {syncMut.isPending ? <Spinner className="text-primary-foreground" /> : <><RefreshCw className="h-4 w-4" /> Sync {kinds.find((k) => k.kind === activeKind)?.label ?? ''}</>}
          </Button>
        </section>

        <section className="rounded-xl border p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Upload className="h-4 w-4" /> Sync report</h2>
          {!report ? (
            <p className="text-sm text-muted-foreground">Run a sync to see the report. Re-running the same export is safe — unchanged rows are skipped.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Created" value={report.created} tone="success" />
                <Stat label="Updated" value={report.updated} tone="success" />
                <Stat label="Unchanged" value={report.unchanged} tone="muted" />
                <Stat label="Failed" value={report.failed} tone={report.failed ? 'destructive' : 'muted'} />
              </div>
              <p className="text-xs text-muted-foreground">{report.total} rows in {report.durationMs} ms</p>
              {report.failed === 0 ? (
                <p className="flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" /> All rows synced.</p>
              ) : (
                <div>
                  <p className="mb-1 flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" /> {report.failed} failed{atomic ? ' (batch rolled back)' : ''}</p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {report.errors.map((er, i) => <li key={i}><span className="font-mono">{er.publicId || `#${er.index}`}</span>: {er.message}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'destructive' | 'muted' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
