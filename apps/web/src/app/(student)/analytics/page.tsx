'use client';
import { useMastery, useProgress } from '@/features/student/hooks/use-student';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function AnalyticsPage() {
  const mastery = useMastery();
  const stats = useProgress();
  const series = (mastery.data ?? []).slice(0, 12).map((t, i) => ({ name: `T${i + 1}`, accuracy: Math.round(t.accuracy * 100) }));

  return (
    <div>
      <PageHeader title="Analytics" description="Trends and deeper cuts on your performance." />
      <QueryBoundary isLoading={mastery.isLoading} isError={mastery.isError} isEmpty={series.length === 0} emptyTitle="No analytics yet" emptyDescription="Keep practicing — your performance trends will populate here.">
        <Card>
          <CardHeader><CardTitle>Accuracy across topics</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <defs>
                  <linearGradient id="acc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#acc)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </QueryBoundary>
    </div>
  );
}
