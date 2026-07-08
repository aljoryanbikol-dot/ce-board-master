'use client';
/**
 * Handbook knowledge tabs backed by the Knowledge Library:
 * Symbols (derived from formula variables), Glossary (concepts),
 * Foundations (review notes), and Last-Minute Review (highest-yield records).
 */
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, BookOpen, AlertTriangle, Lightbulb, Star, ChevronRight } from 'lucide-react';
import { handbookApi } from '../api/handbook-api';
import { QueryBoundary } from '@/components/common/query-boundary';
import { MathText } from '@/components/common/math-text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SymbolsTab() {
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['handbook', 'symbols', q],
    queryFn: () => handbookApi.symbols(q || undefined),
    placeholderData: keepPreviousData,
  });
  return (
    <div>
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search symbol or meaning (e.g. γ, moment, modulus)…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <QueryBoundary isLoading={query.isLoading} isError={query.isError} isEmpty={(query.data?.length ?? 0) === 0} emptyTitle="No symbols" emptyDescription="Try a different search.">
        <div className="grid gap-2 sm:grid-cols-2">
          {(query.data ?? []).map((s) => (
            <Card key={s.symbol}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-mono text-base font-semibold">{s.symbol}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">{s.meanings.join(' · ')}</p>
                    {s.units.length ? <p className="mt-0.5 font-mono text-2xs text-muted-foreground">{s.units.join(', ')}</p> : null}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.formulas.slice(0, 3).map((f) => (
                        <Link key={f.slug} href={`/handbook/formula/${f.slug}`} className="text-2xs text-primary hover:underline">{f.name.split(': ').pop()}</Link>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryBoundary>
    </div>
  );
}

export function GlossaryTab() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['handbook', 'glossary', q, page],
    queryFn: () => handbookApi.glossary({ q: q || undefined, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 20));
  return (
    <div>
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search engineering terms…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      <QueryBoundary isLoading={query.isLoading} isError={query.isError} isEmpty={(query.data?.items.length ?? 0) === 0} emptyTitle="No definitions" emptyDescription="Try a different term.">
        <div className="space-y-2">
          {(query.data?.items ?? []).map((c) => (
            <Card key={c.publicId}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{c.title}</p>
                  {c.subjectCode ? <Badge variant="muted">{c.subjectCode}</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {pages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-muted-foreground">Page {page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        ) : null}
      </QueryBoundary>
    </div>
  );
}

export function FoundationsTab() {
  const query = useQuery({ queryKey: ['handbook', 'foundations'], queryFn: handbookApi.foundations });
  return (
    <QueryBoundary isLoading={query.isLoading} isError={query.isError} isEmpty={(query.data?.length ?? 0) === 0} emptyTitle="No review pages" emptyDescription="Foundations pages appear as review notes sync.">
      <div className="space-y-6">
        {(query.data ?? []).map((g) => (
          <div key={g.subjectCode}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4 text-primary" /> {g.subjectName}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.pages.map((p) => (
                <Link key={p.publicId} href={`/handbook/foundations/${encodeURIComponent(p.publicId)}`} className="block">
                  <Card className="h-full transition-colors hover:border-primary/50">
                    <CardContent className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{p.title}</p>
                        {p.examWeight != null ? <p className="text-2xs text-muted-foreground">exam weight {p.examWeight}%</p> : null}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </QueryBoundary>
  );
}

export function LastMinuteTab() {
  const query = useQuery({ queryKey: ['handbook', 'last-minute'], queryFn: handbookApi.lastMinute });
  const d = query.data;
  return (
    <QueryBoundary isLoading={query.isLoading} isError={query.isError}>
      {d ? (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Star className="h-4 w-4 text-warning" /> Top {d.topFormulas.length} Must-Memorize Formulas</CardTitle></CardHeader>
            <CardContent className="grid gap-1.5 sm:grid-cols-2">
              {d.topFormulas.map((f, i) => (
                <Link key={f.slug} href={`/handbook/formula/${f.slug}`} className="flex items-center gap-2 rounded-md border p-2 text-xs transition-colors hover:border-primary/50">
                  <span className="w-7 shrink-0 font-mono text-2xs text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.name.split(': ').pop()}</span>
                    <span className="block truncate font-mono text-muted-foreground"><MathText text={f.expressionLatex || f.expressionText} /></span>
                  </span>
                  <Badge variant="muted" className="shrink-0">{f.subject.code}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="border-warning/40">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-warning" /> Most Common Board Mistakes</CardTitle></CardHeader>
            <CardContent><ul className="list-disc space-y-1.5 pl-5 text-sm">{d.commonMistakes.map((m, i) => <li key={i}>{m}</li>)}</ul></CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Lightbulb className="h-4 w-4 text-primary" /> Board Solving Tips</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {d.boardTips.map((t, i) => (
                <div key={i} className="rounded-md border p-2 text-xs">
                  <p>{t.tip}</p>
                  {t.subjectCode ? <Badge variant="muted" className="mt-1">{t.subjectCode}</Badge> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </QueryBoundary>
  );
}
