'use client';
import Link from 'next/link';
import { Award, RotateCcw, ListChecks } from 'lucide-react';
import { useExamResult } from '../hooks/use-exams';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/common/stat-card';
import { formatPercent } from '@/lib/utils';

interface Result { scorePercent: number; correctCount: number; totalQuestions: number; passed: boolean; durationUsedSec?: number; resultCode?: string; subjectBreakdown?: Array<{ subjectId: string; scorePercent: number }>; }

export function ExamResultView({ examId }: { examId: string }) {
  const result = useExamResult(examId);
  const r = result.data as Result | undefined;

  return (
    <div>
      <PageHeader title="Exam Result" description="How you performed on this mock board." action={<Button asChild variant="outline"><Link href="/exams"><RotateCcw className="h-4 w-4" /> Take another</Link></Button>} />
      <QueryBoundary isLoading={result.isLoading} isError={result.isError}>
        {r ? (
          <>
            <Card className="mb-6 overflow-hidden">
              <div className="surface-blueprint bg-primary/5 p-8 text-center">
                <Award className={r.passed ? 'mx-auto h-10 w-10 text-success' : 'mx-auto h-10 w-10 text-warning'} />
                <p className="mt-3 font-mono text-5xl font-semibold">{formatPercent(r.scorePercent)}</p>
                <Badge variant={r.passed ? 'success' : 'warning'} className="mt-3">{r.passed ? 'Passed' : 'Keep going'}</Badge>
                {r.resultCode ? <p className="mt-2 font-mono text-2xs uppercase tracking-widest text-muted-foreground">Result code · {r.resultCode}</p> : null}
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Correct" value={`${r.correctCount}/${r.totalQuestions}`} accent="success" />
              <StatCard label="Score" value={formatPercent(r.scorePercent)} accent="primary" />
              <StatCard label="Passing line" value="70%" accent="warning" />
            </div>

            <div className="mt-6 flex gap-3">
              <Button asChild><Link href={`/exams/${examId}/result?tab=review`}><ListChecks className="h-4 w-4" /> Review answers</Link></Button>
            </div>
          </>
        ) : null}
      </QueryBoundary>
    </div>
  );
}
