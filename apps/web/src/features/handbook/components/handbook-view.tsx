'use client';
/**
 * Fundamentals Handbook home — searchable Formula Library plus the
 * data-driven "Must Memorize" shortlist (formulas most linked to real board
 * questions). Every record is a live Knowledge Library projection.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, Star, Printer, ChevronRight } from 'lucide-react';
import { handbookApi } from '../api/handbook-api';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { MathText } from '@/components/common/math-text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function HandbookView() {
  const [q, setQ] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [page, setPage] = useState(1);

  const subjects = useQuery({ queryKey: ['handbook', 'subjects'], queryFn: handbookApi.subjects });
  const formulas = useQuery({
    queryKey: ['handbook', 'formulas', subjectCode, q, page],
    queryFn: () => handbookApi.formulas({ subjectCode: subjectCode || undefined, q: q || undefined, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const memorize = useQuery({ queryKey: ['handbook', 'must-memorize'], queryFn: handbookApi.mustMemorize });

  const total = formulas.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div>
      <PageHeader title="Fundamentals Handbook" description="Your daily engineering reference — every formula, concept, and board tip from the Knowledge Library." />

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Formula Library</TabsTrigger>
          <TabsTrigger value="memorize"><Star className="mr-1 h-3.5 w-3.5" /> Must Memorize</TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search formulas, symbols, variables…"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
              />
            </div>
            <select
              className="rounded-lg border bg-background p-2 text-sm"
              value={subjectCode}
              onChange={(e) => { setSubjectCode(e.target.value); setPage(1); }}
            >
              <option value="">All subjects</option>
              {(subjects.data ?? []).map((s) => (
                <option key={s.code} value={s.code}>{s.name} ({s._count.formulas})</option>
              ))}
            </select>
            {subjectCode ? (
              <Button asChild variant="outline"><Link href={`/handbook/sheet/${subjectCode}`}><Printer className="h-4 w-4" /> Review sheet</Link></Button>
            ) : null}
          </div>

          <QueryBoundary isLoading={formulas.isLoading} isError={formulas.isError} isEmpty={(formulas.data?.items.length ?? 0) === 0} emptyTitle="No formulas found" emptyDescription="Try a different search or subject.">
            <div className="space-y-2">
              {(formulas.data?.items ?? []).map((f) => (
                <Link key={f.slug} href={`/handbook/formula/${f.slug}`} className="block">
                  <Card className="transition-colors hover:border-primary/50">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground"><MathText text={f.expressionLatex || f.expressionText} /></p>
                      </div>
                      <Badge variant="muted" className="hidden sm:inline-flex">{f.subject.code}</Badge>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            {pages > 1 ? (
              <div className="mt-4 flex items-center justify-between text-sm">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span className="text-muted-foreground">Page {page} of {pages} · {total} formulas</span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            ) : null}
          </QueryBoundary>
        </TabsContent>

        <TabsContent value="memorize">
          <p className="mb-4 text-sm text-muted-foreground">
            The formulas most often required by real board questions in each subject — master these before exam day.
          </p>
          <QueryBoundary isLoading={memorize.isLoading} isError={memorize.isError} isEmpty={(memorize.data?.length ?? 0) === 0} emptyTitle="Nothing yet" emptyDescription="Must-memorize lists appear as question links accumulate.">
            <div className="space-y-6">
              {(memorize.data ?? []).map((g) => (
                <div key={g.subjectCode}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{g.subjectName}</h3>
                    <Button asChild variant="ghost" size="sm"><Link href={`/handbook/sheet/${g.subjectCode}`}><Printer className="h-3.5 w-3.5" /> Sheet</Link></Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {g.formulas.map((f) => (
                      <Link key={f.slug} href={`/handbook/formula/${f.slug}`} className="block">
                        <Card className="h-full transition-colors hover:border-primary/50">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium">{f.name}</p>
                              <Badge variant="warning" className="shrink-0 gap-1 text-2xs"><Star className="h-3 w-3" />{f._count.questionFormulas} Qs</Badge>
                            </div>
                            <p className="mt-1 truncate font-mono text-xs text-muted-foreground"><MathText text={f.expressionLatex || f.expressionText} /></p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </QueryBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
