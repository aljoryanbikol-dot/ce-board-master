'use client';
/**
 * One Engineering Foundations page: the Knowledge Library review note
 * (core principles, board strategies) plus the topic's key formulas and
 * concepts — a concise pre-question review stop.
 */
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bot, Sigma } from 'lucide-react';
import { handbookApi } from '../api/handbook-api';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { MathText } from '@/components/common/math-text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function FoundationPageView({ publicId }: { publicId: string }) {
  const query = useQuery({ queryKey: ['handbook', 'foundation', publicId], queryFn: () => handbookApi.foundationPage(publicId) });
  const p = query.data;

  return (
    <div>
      <PageHeader
        title={p?.title ?? 'Foundations'}
        description={p ? [p.subject?.name, p.topicName].filter(Boolean).join(' · ') : ''}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/handbook"><ArrowLeft className="h-4 w-4" /> Handbook</Link></Button>
            {p ? (
              <Button asChild>
                <Link href={`/tutor?ask=${encodeURIComponent(`Give me a rapid board-exam review of "${p.title}" — core principles, the identities I must memorize, and the most common mistakes.`)}`}>
                  <Bot className="h-4 w-4" /> Ask AI Tutor
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <QueryBoundary isLoading={query.isLoading} isError={query.isError}>
        {p ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="whitespace-pre-line p-6 text-sm leading-relaxed">
                <MathText text={p.body} />
              </CardContent>
            </Card>

            {p.formulas.length > 0 ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Sigma className="h-4 w-4" /> Key formulas for this topic</CardTitle></CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {p.formulas.map((f) => (
                    <Link key={f.slug} href={`/handbook/formula/${f.slug}`} className="rounded-lg border p-2 text-xs transition-colors hover:border-primary/50">
                      <p className="font-medium">{f.name.split(': ').pop()}</p>
                      <p className="truncate font-mono text-muted-foreground"><MathText text={f.expressionLatex} /></p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {p.concepts.length > 0 ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Core concepts</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {p.concepts.map((c) => (
                    <div key={c.publicId}><p className="font-medium">{c.title}</p><p className="text-muted-foreground">{c.summary}</p></div>
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
