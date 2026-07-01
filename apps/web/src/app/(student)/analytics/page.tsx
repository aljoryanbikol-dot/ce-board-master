'use client';
import { useState } from 'react';
import { useProgress, useAccuracySpeed, useDistribution } from '@/features/student/hooks/use-student';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/common/stat-card';
import { Button } from '@/components/ui/button';
import { Target, Zap, Clock } from 'lucide-react';
import { formatPercent } from '@/lib/utils';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const PERIODS = [
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
];

const OUTCOME_COLORS: Record<string, string> = {
  correct: 'hsl(var(--success))',
  incorrect: 'hsl(var(--destructive))',
  skipped: 'hsl(var(--muted-foreground))',
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const stats = useProgress(period, 30);
  const accSpeed = useAccuracySpeed();
  const distribution = useDistribution();

  const series = (stats.data?.buckets ?? []).map((b) => ({ date: b.date, accuracy: Math.round(b.accuracy * 100), answered: b.answered }));
  const byOutcome = distribution.data?.byOutcome ?? [];
  const bySubject = distribution.data?.bySubject ?? [];

  return (
    <div>
      <PageHeader title="Analytics" description="Trends and deeper cuts on your performance." />
      <QueryBoundary isLoading={stats.isLoading} isError={stats.isError} error={stats.error} isEmpty={series.length === 0} emptyTitle="No analytics yet" emptyDescription="Keep practicing — your performance trends will populate here.">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="All-time accuracy" value={formatPercent((accSpeed.data?.allTime.accuracy ?? 0) * 100)} icon={Target} accent="primary" />
          <StatCard label="Last 7 days accuracy" value={formatPercent((accSpeed.data?.last7Days.accuracy ?? 0) * 100)} icon={Zap} accent="success" />
          <StatCard label="Avg time / question" value={`${accSpeed.data?.allTime.avgTimeSec ?? 0}s`} icon={Clock} accent="accent" />
        </div>

        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Accuracy over time</CardTitle>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <Button key={p.value} size="sm" variant={period === p.value ? 'default' : 'outline'} onClick={() => setPeriod(p.value)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <defs>
                  <linearGradient id="acc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#acc)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Questions by subject</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bySubject.map((s) => ({ name: s.subjectId.slice(0, 8), count: s.count }))} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Outcome breakdown</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byOutcome} dataKey="count" nameKey="outcome" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {byOutcome.map((o) => <Cell key={o.outcome} fill={OUTCOME_COLORS[o.outcome] ?? 'hsl(var(--muted-foreground))'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </QueryBoundary>
    </div>
  );
}
