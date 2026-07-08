'use client';
/**
 * Full formula reference page: expression, variable definitions with units,
 * engineering meaning, when to use, applications, mistakes to avoid, and
 * every related Knowledge Library record — plus a one-click AI Tutor ask.
 */
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bot, Sigma, ListChecks, AlertTriangle, BookOpen, FileQuestion, Ruler } from 'lucide-react';
import { handbookApi, type FormulaVariable } from '../api/handbook-api';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { MathText } from '@/components/common/math-text';
import { DiagramImage } from '@/components/common/diagram-image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function toVariableList(v: unknown): FormulaVariable[] {
  if (Array.isArray(v)) return v as FormulaVariable[];
  if (v && typeof v === 'object' && Array.isArray((v as { items?: unknown[] }).items)) return (v as { items: FormulaVariable[] }).items;
  return [];
}

export function FormulaDetailView({ slug }: { slug: string }) {
  const query = useQuery({ queryKey: ['handbook', 'formula', slug], queryFn: () => handbookApi.formula(slug) });
  const f = query.data;
  const variables = toVariableList(f?.variables);

  return (
    <div>
      <PageHeader
        title={f?.name ?? 'Formula'}
        description={f ? `${f.subject.name}${f.topic ? ` · ${f.topic.name}` : ''}` : ''}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/handbook"><ArrowLeft className="h-4 w-4" /> Handbook</Link></Button>
            {f ? (
              <Button asChild>
                <Link href={`/tutor?ask=${encodeURIComponent(`Explain the formula "${f.name}" (${f.expressionText}) step by step, with a worked example and common board-exam mistakes.`)}`}>
                  <Bot className="h-4 w-4" /> Ask AI Tutor
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <QueryBoundary isLoading={query.isLoading} isError={query.isError}>
        {f ? (
          <div className="space-y-4">
            {/* The formula itself */}
            <Card className="overflow-hidden">
              <div className="surface-blueprint bg-primary/5 p-6 text-center">
                <p className="font-mono text-lg"><MathText text={f.expressionLatex || f.expressionText} /></p>
                <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="muted">{f.unitsSystem}</Badge>
                  {f.imperialExpression ? <span className="font-mono">Imperial: {f.imperialExpression}</span> : null}
                </div>
              </div>
            </Card>

            {/* Variables */}
            {variables.length > 0 ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Ruler className="h-4 w-4" /> Variables & units</CardTitle></CardHeader>
                <CardContent className="divide-y">
                  {variables.map((v) => (
                    <div key={v.symbol} className="flex items-baseline gap-3 py-2 text-sm">
                      <span className="w-14 shrink-0 font-mono font-semibold">{v.symbol}</span>
                      <span className="flex-1 text-muted-foreground">{v.name ?? v.description}</span>
                      {v.unit ? <Badge variant="muted">{v.unit}</Badge> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {/* Engineering meaning / when to use */}
            {f.exampleProblem ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><BookOpen className="h-4 w-4" /> Engineering meaning & board usage</CardTitle></CardHeader>
                <CardContent className="text-sm leading-relaxed"><MathText text={f.exampleProblem} /></CardContent>
              </Card>
            ) : null}

            {f.typicalApplications.length > 0 ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ListChecks className="h-4 w-4" /> When to use</CardTitle></CardHeader>
                <CardContent><ul className="list-disc space-y-1 pl-5 text-sm">{f.typicalApplications.map((a, i) => <li key={i}>{a}</li>)}</ul></CardContent>
              </Card>
            ) : null}

            {f.derivation ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Sigma className="h-4 w-4" /> Derivation</CardTitle></CardHeader>
                <CardContent className="text-sm leading-relaxed"><MathText text={f.derivation} /></CardContent>
              </Card>
            ) : null}

            {(f.assumptions.length > 0 || f.limitations) ? (
              <Card className="border-warning/40">
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-warning" /> Assumptions & limits — common mistake territory</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  {f.assumptions.length > 0 ? <ul className="list-disc space-y-1 pl-5">{f.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul> : null}
                  {f.limitations ? <p className="mt-2 text-muted-foreground">{f.limitations}</p> : null}
                </CardContent>
              </Card>
            ) : null}

            {/* Related records */}
            {f.relatedDiagrams.map((d) => (
              <Card key={d.publicId}><CardContent className="p-4"><DiagramImage diagram={d} /></CardContent></Card>
            ))}

            {f.relatedConcepts.length > 0 ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Related concepts</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {f.relatedConcepts.map((c) => (
                    <div key={c.publicId}><p className="font-medium">{c.title}</p><p className="text-muted-foreground">{c.summary}</p></div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {f.relatedFormulas.length > 0 ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Related formulas</CardTitle></CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {f.relatedFormulas.map((rf) => (
                    <Link key={rf.slug} href={`/handbook/formula/${rf.slug}`} className="rounded-lg border p-2 text-xs transition-colors hover:border-primary/50">
                      <p className="font-medium">{rf.name}</p>
                      <p className="truncate font-mono text-muted-foreground"><MathText text={rf.expressionLatex} /></p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {f.relatedQuestions.length > 0 ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><FileQuestion className="h-4 w-4" /> Appears in board questions</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {f.relatedQuestions.map((rq) => (
                    <p key={rq.questionCode}><span className="font-mono text-2xs">{rq.questionCode}</span> — {rq.stem}…</p>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </QueryBoundary>
    </div>
  );
}
