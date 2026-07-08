'use client';
/**
 * Question History — every attempted question with outcome filters
 * (All / Wrong answers / Correct / Skipped), the question stem, subject,
 * and time spent. "Wrong answers" is the review workflow: see what you
 * missed, then drill it in the Handbook or Practice.
 */
import { useState } from 'react';
import { useHistory } from '@/features/student/hooks/use-student';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { MathText } from '@/components/common/math-text';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { timeAgo } from '@/lib/utils';

type Outcome = 'all' | 'incorrect' | 'correct' | 'skipped';

interface HistoryRow {
  id: string; questionCode?: string | null; stem?: string | null; subjectCode?: string | null;
  outcome: string; timeSpentSec?: number; answeredAt?: string; attemptedAt?: string;
}

export default function HistoryPage() {
  const [outcome, setOutcome] = useState<Outcome>('all');
  const history = useHistory(outcome === 'all' ? undefined : outcome);
  const rows = (history.data as HistoryRow[] | undefined) ?? [];

  return (
    <div>
      <PageHeader title="Question History" description="Every question you've attempted — filter to your wrong answers and turn them into strengths." />

      <Tabs value={outcome} onValueChange={(v) => setOutcome(v as Outcome)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="incorrect">Wrong answers</TabsTrigger>
          <TabsTrigger value="correct">Correct</TabsTrigger>
          <TabsTrigger value="skipped">Skipped</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        <QueryBoundary isLoading={history.isLoading} isError={history.isError} isEmpty={rows.length === 0} emptyTitle="Nothing here" emptyDescription={outcome === 'incorrect' ? 'No wrong answers with this filter — keep it up!' : 'Your answered questions will be logged here.'}>
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <Badge
                    variant={r.outcome === 'correct' ? 'success' : r.outcome === 'incorrect' ? 'destructive' : 'muted'}
                    className="mt-0.5 shrink-0"
                  >
                    {r.outcome}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    {r.stem ? <p className="text-sm"><MathText text={r.stem} />…</p> : null}
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {r.subjectCode ? <Badge variant="muted">{r.subjectCode}</Badge> : null}
                      {r.questionCode ? <span className="font-mono text-2xs">{r.questionCode}</span> : null}
                      {typeof r.timeSpentSec === 'number' && r.timeSpentSec > 0 ? <span>{r.timeSpentSec}s</span> : null}
                      <span>{timeAgo(r.answeredAt ?? r.attemptedAt ?? '')}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </QueryBoundary>
      </div>
    </div>
  );
}
