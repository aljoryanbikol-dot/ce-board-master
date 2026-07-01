'use client';
import { useMastery, useWeakTopics, useStrongTopics } from '../hooks/use-student';
import { studentApi } from '../api/student-api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { formatPercent } from '@/lib/utils';

const SEVERITY_VARIANT: Record<string, 'destructive' | 'warning' | 'muted'> = { critical: 'destructive', moderate: 'warning', minor: 'muted' };

export function ProgressView() {
  const mastery = useMastery();
  const weak = useWeakTopics();
  const strong = useStrongTopics();
  const gaps = useQuery({ queryKey: [...queryKeys.student.progress, 'knowledge-gaps'], queryFn: studentApi.knowledgeGaps });

  const masteryData = (mastery.data ?? []).slice(0, 8).map((t) => ({ name: t.topicId.slice(0, 6), accuracy: Math.round(t.accuracy * 100) }));
  const avg = masteryData.length ? Math.round(masteryData.reduce((s, m) => s + m.accuracy, 0) / masteryData.length) : 0;

  return (
    <div>
      <PageHeader title="Progress" description="Mastery by topic, weak areas, and your trajectory." />
      <QueryBoundary isLoading={mastery.isLoading} isError={mastery.isError} isEmpty={masteryData.length === 0} emptyTitle="No progress data yet" emptyDescription="Answer some practice questions to start building your mastery profile.">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Mastery by topic</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={masteryData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="accuracy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Overall</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ name: 'avg', value: avg, fill: 'hsl(var(--primary))' }]} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={8} />
                </RadialBarChart>
              </ResponsiveContainer>
              <p className="text-center font-mono text-2xl font-semibold">{formatPercent(avg)}</p>
              <p className="text-center text-xs text-muted-foreground">average mastery</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Weak topics</CardTitle></CardHeader>
            <CardContent>
              {weak.data && weak.data.length > 0 ? (
                <ul className="divide-y">
                  {weak.data.map((t) => (
                    <li key={t.topicId} className="flex items-center justify-between py-3 text-sm">
                      <span className="text-muted-foreground">Topic {t.topicId.slice(0, 8)} · {t.tier}</span>
                      <span className="font-mono font-medium text-warning">{formatPercent(t.accuracy * 100)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No weak topics — nice work.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Strong topics</CardTitle></CardHeader>
            <CardContent>
              {strong.data && strong.data.length > 0 ? (
                <ul className="divide-y">
                  {strong.data.map((t) => (
                    <li key={t.topicId} className="flex items-center justify-between py-3 text-sm">
                      <span className="text-muted-foreground">Topic {t.topicId.slice(0, 8)} · {t.tier}</span>
                      <span className="font-mono font-medium text-success">{formatPercent(t.accuracy * 100)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Keep practicing to build up mastered topics.</p>}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader><CardTitle>Knowledge gaps</CardTitle></CardHeader>
          <CardContent>
            {gaps.data && gaps.data.length > 0 ? (
              <ul className="divide-y">
                {gaps.data.map((g) => (
                  <li key={g.topicId} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{g.recommendation ?? `Topic ${g.topicId.slice(0, 8)}`}</span>
                    <Badge variant={SEVERITY_VARIANT[g.severity] ?? 'muted'}>{g.severity}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No detected knowledge gaps right now.</p>}
          </CardContent>
        </Card>
      </QueryBoundary>
    </div>
  );
}
