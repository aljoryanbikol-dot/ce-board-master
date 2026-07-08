'use client';
/** Engineering Constants & Tables — static appendix data, filterable. */
import { useState } from 'react';
import { Search } from 'lucide-react';
import { REFERENCE_SECTIONS } from '../data/engineering-reference';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function ReferenceTab() {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();

  const sections = REFERENCE_SECTIONS.map((s) => ({
    ...s,
    rows: s.rows?.filter((r) => !needle || `${r.label} ${r.value} ${r.note ?? ''}`.toLowerCase().includes(needle)),
    tables: s.tables?.map((t) => ({
      ...t,
      rows: t.rows.filter((row) => !needle || row.join(' ').toLowerCase().includes(needle)),
    })).filter((t) => t.rows.length > 0),
  })).filter((s) => (s.rows?.length ?? 0) > 0 || (s.tables?.length ?? 0) > 0);

  return (
    <div>
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Filter constants, conversions, tables…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.id} className="break-inside-avoid">
            <CardHeader className="pb-2"><CardTitle className="text-sm">{s.title}</CardTitle></CardHeader>
            <CardContent>
              {s.rows?.length ? (
                <div className="divide-y">
                  {s.rows.map((r) => (
                    <div key={r.label} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="text-right font-mono text-xs">{r.value}{r.note ? <span className="block text-2xs text-muted-foreground">{r.note}</span> : null}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {s.tables?.map((t) => (
                <div key={t.id} className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b text-left text-2xs uppercase tracking-wider text-muted-foreground">{t.columns.map((c) => <th key={c} className="py-1.5 pr-3">{c}</th>)}</tr></thead>
                    <tbody>
                      {t.rows.map((row, i) => (
                        <tr key={i} className="border-b border-border/50">{row.map((cell, j) => <td key={j} className={j === 0 ? 'py-1.5 pr-3' : 'py-1.5 pr-3 font-mono'}>{cell}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
