'use client';
import { DollarSign, Users, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/features/admin/api/admin-api';
import { queryKeys } from '@/lib/query/keys';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { StatCard } from '@/components/common/stat-card';
import { formatMoney } from '@/lib/utils';

export default function AdminBillingPage() {
  const query = useQuery({ queryKey: [...queryKeys.admin.analytics, 'billing'], queryFn: adminApi.billingOverview });
  const o = (query.data as { mrrMinor?: number; activeSubscribers?: number; churnRate?: number } | undefined) ?? {};
  return (
    <div>
      <PageHeader title="Billing" description="Revenue and subscription overview." />
      <QueryBoundary isLoading={query.isLoading} isError={query.isError}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="MRR" value={o.mrrMinor != null ? formatMoney(o.mrrMinor) : '—'} icon={DollarSign} accent="success" />
          <StatCard label="Active subscribers" value={o.activeSubscribers ?? '—'} icon={Users} accent="primary" />
          <StatCard label="Churn" value={o.churnRate != null ? `${o.churnRate}%` : '—'} icon={TrendingUp} accent="warning" />
        </div>
      </QueryBoundary>
    </div>
  );
}
