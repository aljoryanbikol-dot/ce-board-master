'use client';
import { Flame, Target, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useDashboard, useWeakTopics } from '../hooks/use-student';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatPercent } from '@/lib/utils';

export function DashboardView() {
  const dash = useDashboard();
  const weak = useWeakTopics();
  const d = dash.data ?? {};
  const mastery = typeof d.masteryAverage === 'number' ? d.masteryAverage : 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your readiness at a glance."
        action={<Button asChild><Link href="/practice">Start practice <ArrowRight className="h-4 w-4" /></Link></Button>}
      />

      <QueryBoundary isLoading={dash.isLoading} isError={dash.isError}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Day streak" value={d.streak ?? 0} icon={Flame} accent="accent" hint="Keep it going" />
          <StatCard label="Avg mastery" value={formatPercent(mastery)} icon={Target} accent="primary" />
          <StatCard label="Questions answered" value={d.questionsAnswered ?? 0} icon={CheckCircle2} accent="success" />
          <StatCard label="Weak topics" value={d.weakTopicsCount ?? weak.data?.length ?? 0} icon={AlertTriangle} accent="warning" hint="Focus here next" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Overall readiness</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="font-mono text-4xl font-semibold">{formatPercent(mastery)}</span>
                <Badge variant={mastery >= 70 ? 'success' : 'warning'}>{mastery >= 70 ? 'On track' : 'Building up'}</Badge>
              </div>
              <Progress value={mastery} className="mt-4" />
              <p className="mt-3 text-sm text-muted-foreground">A blended score across all subjects you've practiced. Aim for 70%+ before exam day.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Focus next</CardTitle></CardHeader>
            <CardContent>
              {weak.data && weak.data.length > 0 ? (
                <ul className="space-y-3">
                  {weak.data.slice(0, 4).map((t) => (
                    <li key={t.topicId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-muted-foreground">Topic {t.topicId.slice(0, 8)}</span>
                      <Badge variant="warning">{formatPercent(t.accuracy * 100)}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No weak topics flagged yet. Practice more to surface your gaps.</p>
              )}
              <Button asChild variant="outline" className="mt-4 w-full"><Link href="/progress">View full progress</Link></Button>
            </CardContent>
          </Card>
        </div>
      </QueryBoundary>
    </div>
  );
}
