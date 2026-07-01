'use client';
import { useState } from 'react';
import {
  Users, UserCheck, Sparkles, DollarSign, BookOpen, FileText, Bot,
} from 'lucide-react';
import {
  usePlatformOverview, useUserGrowth, useActiveUsers, usePlatformRevenue,
  useQuestionUsage, useExamUsage, useAiTutorUsage, useSubjectPerformance,
  useHardestQuestions, useHardestTopics, useRetention,
} from '@/features/admin/hooks/use-admin';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { StatCard } from '@/components/common/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatMoney, formatPercent } from '@/lib/utils';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Line, LineChart } from 'recharts';

const PERIODS = [
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
];

export default function PlatformAnalyticsPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const overview = usePlatformOverview();
  const growth = useUserGrowth(period, 30);
  const active = useActiveUsers(period, 30);
  const revenue = usePlatformRevenue(30);
  const questionUsage = useQuestionUsage(period, 30);
  const examUsage = useExamUsage(period, 30);
  const tutorUsage = useAiTutorUsage(period, 30);
  const subjectPerf = useSubjectPerformance();
  const hardestQuestions = useHardestQuestions(10);
  const hardestTopics = useHardestTopics(10);
  const retention = useRetention();

  const o = overview.data;

  return (
    <div>
      <PageHeader title="Platform Analytics" description="User growth, usage, revenue, and content performance across the whole platform." />

      <QueryBoundary isLoading={overview.isLoading} isError={overview.isError} error={overview.error}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={o?.totalUsers ?? 0} icon={Users} accent="primary" />
          <StatCard label="Premium users" value={o?.premiumUsers ?? 0} icon={UserCheck} accent="success" hint={o ? `${o.freeUsers} free` : undefined} />
          <StatCard label="MRR" value={o ? formatMoney(o.mrrMinor) : '—'} icon={DollarSign} accent="success" />
          <StatCard label="Questions answered" value={o?.totalQuestionsAnswered ?? 0} icon={BookOpen} accent="accent" />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard label="Mock exams started" value={o?.mockExamsStarted ?? 0} icon={FileText} accent="primary" />
          <StatCard label="Mock exams completed" value={o?.mockExamsCompleted ?? 0} icon={FileText} accent="success" />
          <StatCard label="AI Tutor conversations" value={o?.totalTutorConversations ?? 0} icon={Bot} accent="accent" />
        </div>
      </QueryBoundary>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>User growth &amp; active users</CardTitle>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Button key={p.value} size="sm" variant={period === p.value ? 'default' : 'outline'} onClick={() => setPeriod(p.value)}>{p.label}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <QueryBoundary isLoading={growth.isLoading} isError={growth.isError} error={growth.error} isEmpty={(growth.data ?? []).length === 0} emptyTitle="No signups yet">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={growth.data ?? []} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <defs>
                  <linearGradient id="growth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" name="Signups" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#growth)" />
              </AreaChart>
            </ResponsiveContainer>
          </QueryBoundary>
          <div className="mt-4">
            <QueryBoundary isLoading={active.isLoading} isError={active.isError} error={active.error} isEmpty={(active.data ?? []).length === 0} emptyTitle="No activity yet">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={active.data ?? []} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="activeUsers" name="Active users" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </QueryBoundary>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Question usage</CardTitle></CardHeader>
          <CardContent>
            <QueryBoundary isLoading={questionUsage.isLoading} isError={questionUsage.isError} error={questionUsage.error} isEmpty={(questionUsage.data ?? []).length === 0} emptyTitle="No attempts yet">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={questionUsage.data ?? []} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </QueryBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mock exam usage</CardTitle></CardHeader>
          <CardContent>
            <QueryBoundary isLoading={examUsage.isLoading} isError={examUsage.isError} error={examUsage.error} isEmpty={(examUsage.data ?? []).length === 0} emptyTitle="No exams yet">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={examUsage.data ?? []} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="started" name="Started" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </QueryBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>AI Tutor usage</CardTitle></CardHeader>
          <CardContent>
            <QueryBoundary isLoading={tutorUsage.isLoading} isError={tutorUsage.isError} error={tutorUsage.error} isEmpty={(tutorUsage.data ?? []).length === 0} emptyTitle="No conversations yet">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={tutorUsage.data ?? []} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="conversations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </QueryBoundary>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Subject performance (all users)</CardTitle></CardHeader>
          <CardContent>
            <QueryBoundary isLoading={subjectPerf.isLoading} isError={subjectPerf.isError} error={subjectPerf.error} isEmpty={(subjectPerf.data ?? []).length === 0} emptyTitle="No data yet">
              <ul className="divide-y">
                {(subjectPerf.data ?? []).map((s) => (
                  <li key={s.subjectId} className="flex items-center justify-between py-3 text-sm">
                    <span className="text-muted-foreground">Subject {s.subjectId.slice(0, 8)} · {s.attempts} attempts</span>
                    <Badge variant={s.accuracy >= 0.7 ? 'success' : s.accuracy >= 0.5 ? 'warning' : 'destructive'}>{formatPercent(s.accuracy * 100)}</Badge>
                  </li>
                ))}
              </ul>
            </QueryBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Retention by signup cohort</CardTitle></CardHeader>
          <CardContent>
            <QueryBoundary isLoading={retention.isLoading} isError={retention.isError} error={retention.error} isEmpty={(retention.data ?? []).length === 0} emptyTitle="No cohorts yet">
              <ul className="divide-y">
                {(retention.data ?? []).map((r) => (
                  <li key={r.windowDays} className="flex items-center justify-between py-3 text-sm">
                    <span className="text-muted-foreground">Day {r.windowDays} return rate ({r.cohortSize} in cohort)</span>
                    <span className="font-mono font-medium">{formatPercent(r.returnRate * 100)}</span>
                  </li>
                ))}
              </ul>
            </QueryBoundary>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Hardest questions</CardTitle></CardHeader>
          <CardContent>
            <QueryBoundary isLoading={hardestQuestions.isLoading} isError={hardestQuestions.isError} error={hardestQuestions.error} isEmpty={(hardestQuestions.data ?? []).length === 0} emptyTitle="Not enough attempts yet">
              <ul className="divide-y">
                {(hardestQuestions.data ?? []).map((q) => (
                  <li key={q.questionId} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{q.questionCode ?? q.questionId.slice(0, 8)} — {q.stemText ?? ''}</span>
                    <Badge variant="destructive">{formatPercent(q.accuracy * 100)}</Badge>
                  </li>
                ))}
              </ul>
            </QueryBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Hardest topics</CardTitle></CardHeader>
          <CardContent>
            <QueryBoundary isLoading={hardestTopics.isLoading} isError={hardestTopics.isError} error={hardestTopics.error} isEmpty={(hardestTopics.data ?? []).length === 0} emptyTitle="Not enough attempts yet">
              <ul className="divide-y">
                {(hardestTopics.data ?? []).map((t) => (
                  <li key={t.topicId} className="flex items-center justify-between py-3 text-sm">
                    <span className="text-muted-foreground">Topic {t.topicId.slice(0, 8)} · {t.attempts} attempts</span>
                    <Badge variant="destructive">{formatPercent(t.accuracy * 100)}</Badge>
                  </li>
                ))}
              </ul>
            </QueryBoundary>
          </CardContent>
        </Card>
      </div>

      {revenue.data ? (
        <Card className="mt-6">
          <CardHeader><CardTitle>Revenue by plan</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {revenue.data.byPlan.map((p) => (
                <li key={p.planId} className="flex items-center justify-between py-3 text-sm">
                  <span>{p.name} <span className="text-muted-foreground">· {p.subscriberCount} subscribers</span></span>
                  <span className="font-mono font-medium">{formatMoney(p.mrrMinor)}/mo</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
