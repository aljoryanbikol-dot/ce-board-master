'use client';
import { useState } from 'react';
import { useSubscription, usePlans, useChangePlan, useCancelSubscription } from '@/features/billing/hooks/use-billing';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function formatPrice(priceMinor: number, currency: string) {
  return `${currency} ${(priceMinor / 100).toFixed(2)}`;
}

export default function SubscriptionPage() {
  const sub = useSubscription();
  const plans = usePlans();
  const changePlan = useChangePlan();
  const cancel = useCancelSubscription();
  const [open, setOpen] = useState(false);
  const s = sub.data;

  return (
    <div>
      <PageHeader title="Subscription" description="Manage your plan." />
      <QueryBoundary isLoading={sub.isLoading} isError={sub.isError}>
        <Card>
          <CardHeader><CardTitle>Current plan</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-2xl font-semibold capitalize">{s?.planName ?? s?.tier ?? 'Free'}</p>
                <Badge variant={s?.status === 'active' ? 'success' : 'muted'} className="mt-2">{s?.status ?? 'inactive'}</Badge>
              </div>
              <div className="flex gap-2">
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild><Button variant="outline">Change plan</Button></DialogTrigger>
                  <DialogContent>
                    <DialogTitle>Choose a plan</DialogTitle>
                    <QueryBoundary isLoading={plans.isLoading} isError={plans.isError}>
                      <div className="space-y-3">
                        {plans.data?.filter((p) => p.isActive).map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-md border p-4">
                            <div>
                              <p className="font-medium">{p.name}</p>
                              <p className="text-sm text-muted-foreground">{formatPrice(p.priceMinor, p.currency)} / {p.interval}</p>
                            </div>
                            <Button
                              size="sm"
                              disabled={p.id === s?.planId || changePlan.isPending}
                              onClick={() => changePlan.mutate(p.id, { onSuccess: () => setOpen(false) })}
                            >
                              {p.id === s?.planId ? 'Current' : 'Select'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </QueryBoundary>
                    {changePlan.isError ? <p className="text-sm text-destructive">Could not change plan. Please try again.</p> : null}
                  </DialogContent>
                </Dialog>
                {s && !s.cancelAtPeriodEnd ? (
                  <Button variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
            {s?.currentPeriodEnd ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {s.cancelAtPeriodEnd ? 'Ends' : 'Renews'} {new Date(s.currentPeriodEnd).toLocaleDateString()}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </QueryBoundary>
    </div>
  );
}
