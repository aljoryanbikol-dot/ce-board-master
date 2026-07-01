'use client';
import { Flame, Target, CheckCircle2, AlertTriangle, ArrowRight, Trophy, Award } from 'lucide-react';
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
  // overallAccuracy is a 0..1 ratio; the UI works in 0..100 percentages.
  const mastery = (d.progress?.overallAccuracy ?? 0) * 100;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your readiness at a glance."
        action={<Button asChild><Link href="/practice">Start practice <ArrowRight className="h-4 w-4" /></Link></Button>}
      />

      <QueryBoundary isLoading={dash.isLoading} isError={dash.isError}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Day streak" value={d.streak?.current ?? 0} icon={Flame} accent="accent" hint="Keep it going" />
          <StatCard label="Avg mastery" value={formatPercent(mastery)} icon={Target} accent="primary" />
          <StatCard label="Questions answered" value={d.progress?.totalAnswered ?? 0} icon={CheckCircle2} accent="success" />
          <StatCard label="Weak topics" value={d.weakTopics?.length ?? weak.data?.length ?? 0} icon={AlertTriangle} accent="warning" hint="Focus here next" />
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

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" /> Level {d.xp?.level ?? 1}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="font-mono text-2xl font-semibold">{d.xp?.totalXp ?? 0} XP</span>
                <span className="text-xs text-muted-foreground">{d.xp?.xpIntoLevel ?? 0} / {d.xp?.xpForNextLevel ?? 100} to next level</span>
              </div>
              <Progress value={d.xp?.xpForNextLevel ? Math.min(100, Math.round(((d.xp.xpIntoLevel ?? 0) / d.xp.xpForNextLevel) * 100)) : 0} className="mt-4" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-4 w-4" /> Recent achievements</CardTitle></CardHeader>
            <CardContent>
              {d.recentAchievements && d.recentAchievements.length > 0 ? (
                <ul className="space-y-3">
                  {d.recentAchievements.map((a) => (
                    <li key={a.code} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{new Date(a.earnedAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Answer questions and complete sessions to earn your first badge.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </QueryBoundary>
    </div>
  );
}
