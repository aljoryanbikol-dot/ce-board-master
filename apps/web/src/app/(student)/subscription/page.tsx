'use client';
import { useSubscription } from '@/features/billing/hooks/use-billing';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SubscriptionPage() {
  const sub = useSubscription();
  const s = sub.data;
  return (
    <div>
      <PageHeader title="Subscription" description="Manage your plan." />
      <QueryBoundary isLoading={sub.isLoading} isError={sub.isError}>
        <Card>
          <CardHeader><CardTitle>Current plan</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div><p className="font-display text-2xl font-semibold capitalize">{s?.tier ?? 'Free'}</p><Badge variant={s?.status === 'active' ? 'success' : 'muted'} className="mt-2">{s?.status ?? 'inactive'}</Badge></div>
              <Button variant="outline">Change plan</Button>
            </div>
            {s?.renewsAt ? <p className="mt-4 text-sm text-muted-foreground">Renews {new Date(s.renewsAt).toLocaleDateString()}</p> : null}
          </CardContent>
        </Card>
      </QueryBoundary>
    </div>
  );
}
