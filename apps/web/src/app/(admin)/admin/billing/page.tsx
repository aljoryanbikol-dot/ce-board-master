'use client';
import { DollarSign, Users, TrendingUp, Smartphone, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/features/admin/api/admin-api';
import { billingApi } from '@/features/billing/api/billing-api';
import { queryKeys } from '@/lib/query/keys';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { StatCard } from '@/components/common/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { formatMoney, timeAgo } from '@/lib/utils';

/**
 * Pending direct-GCash payments queue. The admin checks the transfer in
 * their GCash app (match the reference number + amount) and approves —
 * approval activates the buyer's plan through the normal payment pipeline.
 */
function ManualGcashQueue() {
  const qc = useQueryClient();
  const pending = useQuery({ queryKey: ['admin', 'manual-gcash-pending'], queryFn: billingApi.manualPending, refetchInterval: 60_000 });
  const settle = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      action === 'approve' ? billingApi.manualApprove(id) : billingApi.manualReject(id),
    onSuccess: (_d, v) => {
      toast.success(v.action === 'approve' ? 'Payment approved — plan activated' : 'Payment rejected');
      qc.invalidateQueries({ queryKey: ['admin', 'manual-gcash-pending'] });
    },
    onError: (err) => toast.fromError(err, 'Could not settle payment'),
  });
  const rows = pending.data ?? [];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" /> GCash payments awaiting verification
          {rows.length > 0 ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600">{rows.length}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <QueryBoundary isLoading={pending.isLoading} isError={pending.isError} isEmpty={rows.length === 0} emptyTitle="Walang pending" emptyDescription="Lalabas dito ang mga GCash payment na naghihintay ng approval.">
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm">
                <div>
                  <p className="font-medium">{r.email}</p>
                  <p className="text-muted-foreground">
                    {r.plan} · <span className="font-mono font-semibold text-foreground">{formatMoney(r.amountMinor)}</span> ·
                    Ref <span className="font-mono">{r.referenceNo}</span> · {timeAgo(r.submittedAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={settle.isPending} onClick={() => settle.mutate({ id: r.id, action: 'approve' })}>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={settle.isPending} onClick={() => settle.mutate({ id: r.id, action: 'reject' })}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

export default function AdminBillingPage() {
  const query = useQuery({ queryKey: [...queryKeys.admin.analytics, 'billing'], queryFn: adminApi.billingOverview });
  const o = (query.data as { mrrMinor?: number; activeSubscribers?: number; churnRate?: number } | undefined) ?? {};
  return (
    <div>
      <PageHeader title="Billing" description="Revenue, subscriptions, and GCash payment approvals." />
      <QueryBoundary isLoading={query.isLoading} isError={query.isError}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="MRR" value={o.mrrMinor != null ? formatMoney(o.mrrMinor) : '—'} icon={DollarSign} accent="success" />
          <StatCard label="Active subscribers" value={o.activeSubscribers ?? '—'} icon={Users} accent="primary" />
          <StatCard label="Churn" value={o.churnRate != null ? `${o.churnRate}%` : '—'} icon={TrendingUp} accent="warning" />
        </div>
      </QueryBoundary>
      <ManualGcashQueue />
    </div>
  );
}
