'use client';
import { FileText, Users, ClipboardCheck, Sparkles } from 'lucide-react';
import { useAdminAnalytics } from '@/features/admin/hooks/use-admin';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { StatCard } from '@/components/common/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDashboardPage() {
  const analytics = useAdminAnalytics();
  const a = (analytics.data as { totalQuestions?: number; totalUsers?: number; pendingReview?: number; aiGenerations?: number } | undefined) ?? {};
  return (
    <div>
      <PageHeader title="Admin Dashboard" description="Platform health and content operations at a glance." />
      <QueryBoundary isLoading={analytics.isLoading} isError={analytics.isError}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Questions" value={a.totalQuestions ?? '—'} icon={FileText} accent="primary" />
          <StatCard label="Users" value={a.totalUsers ?? '—'} icon={Users} accent="success" />
          <StatCard label="Pending review" value={a.pendingReview ?? '—'} icon={ClipboardCheck} accent="warning" />
          <StatCard label="AI generations" value={a.aiGenerations ?? '—'} icon={Sparkles} accent="accent" />
        </div>
        <Card className="mt-6">
          <CardHeader><CardTitle>Operations</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Use the sidebar to manage the question bank, knowledge base, editorial review queue, AI content generation, users, roles, and system settings.</p></CardContent>
        </Card>
      </QueryBoundary>
    </div>
  );
}
