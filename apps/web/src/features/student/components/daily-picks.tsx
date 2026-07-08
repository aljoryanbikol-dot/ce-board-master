'use client';
/**
 * Dashboard "of the Day" row — Formula, Concept, and Board Tip picked
 * deterministically per UTC day from the Knowledge Library (see
 * HandbookService.daily). Each card deep-links into the Fundamentals Handbook.
 */
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Sigma, BookOpen, Lightbulb, ArrowRight, BookMarked, Zap } from 'lucide-react';
import { handbookApi } from '@/features/handbook/api/handbook-api';
import { MathText } from '@/components/common/math-text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function DailyPicksRow() {
  const daily = useQuery({ queryKey: ['handbook', 'daily'], queryFn: handbookApi.daily, staleTime: 60 * 60 * 1000 });
  const d = daily.data;
  if (!d || (!d.formula && !d.concept && !d.tip)) return null;

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      {d.formula ? (
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Sigma className="h-4 w-4 text-primary" /> Formula of the Day</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <p className="text-sm font-medium">{d.formula.name}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground"><MathText text={d.formula.expressionLatex || d.formula.expressionText} /></p>
            {d.formula.exampleProblem ? <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{d.formula.exampleProblem}</p> : null}
            <div className="mt-auto flex items-center justify-between pt-3">
              <Badge variant="muted">{d.formula.subject.code}</Badge>
              <Link href={`/handbook/formula/${d.formula.slug}`} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Open in Handbook <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {d.concept ? (
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><BookOpen className="h-4 w-4 text-primary" /> Concept of the Day</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <p className="text-sm font-medium">{d.concept.title}</p>
            <p className="mt-1 line-clamp-4 text-xs text-muted-foreground">{d.concept.body}</p>
            <div className="mt-auto flex items-center justify-between pt-3">
              {d.concept.subjectCode ? <Badge variant="muted">{d.concept.subjectCode}</Badge> : <span />}
              <Link href="/handbook" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Fundamentals Handbook <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {d.tip ? (
        <Card className="flex flex-col border-warning/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Lightbulb className="h-4 w-4 text-warning" /> Board Tip of the Day</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <p className="line-clamp-5 text-sm leading-relaxed">{d.tip.tip}</p>
            <div className="mt-auto pt-3">
              {d.tip.subjectCode ? <Badge variant="muted">{d.tip.subjectCode}</Badge> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {d.definition ? (
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><BookMarked className="h-4 w-4 text-primary" /> Definition of the Day</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <p className="text-sm font-medium">{d.definition.title}</p>
            <p className="mt-1 line-clamp-4 text-xs text-muted-foreground">{d.definition.body}</p>
            <div className="mt-auto flex items-center justify-between pt-3">
              {d.definition.subjectCode ? <Badge variant="muted">{d.definition.subjectCode}</Badge> : <span />}
              <Link href="/handbook?tab=glossary" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Glossary <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="flex flex-col border-primary/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 text-primary" /> Daily Quick Quiz</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <p className="text-sm text-muted-foreground">A short mixed set to keep your streak alive — five minutes, all subjects.</p>
          <div className="mt-auto pt-3">
            <Link href="/practice" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Start today&apos;s quiz <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
