'use client';
import { useAdminAnalytics } from '@/features/admin/hooks/use-admin';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function AdminAnalyticsPage() {
  const query = useAdminAnalytics();
  const a = (query.data as { activityByDay?: Array<{ day: string; count: number }> } | undefined) ?? {};
  const series = a.activityByDay ?? [];
  return (
    <div>
      <PageHeader title="Analytics" description="Platform-wide engagement and content metrics." />
      <QueryBoundary isLoading={query.isLoading} isError={query.isError} isEmpty={series.length === 0} emptyTitle="No analytics yet" emptyDescription="Usage data will populate as students engage.">
        <Card>
          <CardHeader><CardTitle>Activity (last 14 days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={series} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </QueryBoundary>
    </div>
  );
}
