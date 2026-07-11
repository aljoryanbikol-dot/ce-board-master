'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSubscription, usePlans, useSubscribe, useChangePlan, useCancelSubscription } from '@/features/billing/hooks/use-billing';
import { billingApi, type Plan } from '@/features/billing/api/billing-api';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Smartphone, Copy, CheckCircle2 } from 'lucide-react';

function formatPrice(priceMinor: number, currency: string) {
  return `${currency === 'PHP' ? '₱' : currency + ' '}${(priceMinor / 100).toFixed(2)}`;
}

/**
 * Direct-GCash payment dialog: shows the platform GCash number (number only,
 * never the account holder's name), collects the GCash reference number, and
 * submits it for admin verification.
 */
function GcashDialog({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const config = useQuery({ queryKey: ['manual-gcash-config'], queryFn: billingApi.manualConfig });
  const [refNo, setRefNo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: () => billingApi.manualSubmit({ planId: plan.id, referenceNo: refNo }),
    onSuccess: () => { setSubmitted(true); qc.invalidateQueries({ queryKey: ['manual-gcash-mine'] }); },
    onError: (err) => toast.fromError(err, 'Hindi ma-submit — baka nagamit na ang reference number.'),
  });

  if (submitted) {
    return (
      <div className="space-y-3 py-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="font-semibold">Salamat! Na-submit na ang bayad mo.</p>
        <p className="text-sm text-muted-foreground">
          Ive-verify namin ito at awtomatikong maa-activate ang {plan.name} mo —
          karaniwan sa loob ng ilang oras. Makikita mo ang status dito sa page na ito.
        </p>
        <Button onClick={onDone}>OK</Button>
      </div>
    );
  }

  return (
    <QueryBoundary isLoading={config.isLoading} isError={config.isError}>
      {config.data ? (
        <div className="space-y-4">
          <div className="rounded-md border bg-secondary/50 p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">I-send ang eksaktong halaga sa GCash</p>
            <p className="mt-1 font-mono text-2xl font-bold">{config.data.accountNumber}</p>
            <p className="text-sm text-muted-foreground">{config.data.accountLabel}</p>
            <p className="mt-2 font-display text-xl font-semibold text-primary">{formatPrice(plan.priceMinor, plan.currency)}</p>
            <Button
              variant="outline" size="sm" className="mt-2"
              onClick={() => { navigator.clipboard.writeText(config.data!.accountNumber); toast.success('Na-copy ang GCash number'); }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy number
            </Button>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {config.data.instructions.map((i) => <li key={i}>{i}</li>)}
          </ol>
          <div>
            <label className="mb-1 block text-sm font-medium">GCash Reference No.</label>
            <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="e.g. 1234567890123" />
          </div>
          <Button className="w-full" disabled={refNo.trim().length < 6 || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? <Spinner className="text-primary-foreground" /> : 'Submit for verification'}
          </Button>
        </div>
      ) : null}
    </QueryBoundary>
  );
}

export default function SubscriptionPage() {
  const sub = useSubscription();
  const plans = usePlans();
  const subscribe = useSubscribe();
  const changePlan = useChangePlan();
  const cancel = useCancelSubscription();
  const mine = useQuery({ queryKey: ['manual-gcash-mine'], queryFn: billingApi.manualMine });
  const [open, setOpen] = useState(false);
  const [gcashPlan, setGcashPlan] = useState<Plan | null>(null);
  const s = sub.data;
  // A free-tier user has no Subscription row at all — that path goes through
  // POST /subscriptions (subscribe), not POST /subscriptions/change.
  const hasExistingSubscription = !!s;
  const pending = subscribe.isPending || changePlan.isPending;
  const pendingManual = (mine.data ?? []).find((m) => m.status === 'processing');

  function selectPlan(planId: string) {
    // A paid plan (subscribe) or an upgrade (change) carries a
    // payment.checkoutUrl that we MUST redirect to.
    const onSuccess = (result: { payment: { checkoutUrl: string | null } | null }) => {
      if (result.payment?.checkoutUrl) {
        window.location.href = result.payment.checkoutUrl;
        return;
      }
      setOpen(false);
    };
    if (hasExistingSubscription) {
      changePlan.mutate(planId, { onSuccess });
    } else {
      subscribe.mutate(planId, { onSuccess });
    }
  }

  return (
    <div>
      <PageHeader title="Subscription" description="Manage your plan." />
      <QueryBoundary isLoading={sub.isLoading} isError={sub.isError}>
        {pendingManual ? (
          <Card className="mb-4 border-amber-500/50 bg-amber-500/10">
            <CardContent className="flex items-center gap-3 p-4 text-sm">
              <Smartphone className="h-5 w-5 shrink-0 text-amber-500" />
              <span>
                May pending GCash payment ka (Ref: <span className="font-mono">{pendingManual.referenceNo}</span>) —
                vine-verify pa ito. Maa-activate ang Premium mo pagka-approve.
              </span>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader><CardTitle>Current plan</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-2xl font-semibold capitalize">{s?.planName ?? s?.tier ?? 'Free'}</p>
                <Badge variant={s?.status === 'active' ? 'success' : 'muted'} className="mt-2">{s?.status ?? 'inactive'}</Badge>
              </div>
              <div className="flex gap-2">
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setGcashPlan(null); }}>
                  <DialogTrigger asChild><Button variant="outline">{hasExistingSubscription ? 'Change plan' : 'Upgrade to Premium'}</Button></DialogTrigger>
                  <DialogContent>
                    {gcashPlan ? (
                      <>
                        <DialogTitle>Pay {gcashPlan.name} via GCash</DialogTitle>
                        <GcashDialog plan={gcashPlan} onDone={() => { setGcashPlan(null); setOpen(false); }} />
                      </>
                    ) : (
                      <>
                        <DialogTitle>Choose a plan</DialogTitle>
                        <QueryBoundary isLoading={plans.isLoading} isError={plans.isError}>
                          <div className="space-y-3">
                            {plans.data?.filter((p) => p.isActive).map((p) => (
                              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-4">
                                <div>
                                  <p className="font-medium">{p.name}</p>
                                  <p className="text-sm text-muted-foreground">{formatPrice(p.priceMinor, p.currency)} / {p.interval}</p>
                                </div>
                                {p.id === s?.planId ? (
                                  <Button size="sm" disabled>Current</Button>
                                ) : p.priceMinor === 0 ? (
                                  <Button size="sm" disabled={pending} onClick={() => selectPlan(p.id)}>Select</Button>
                                ) : (
                                  <div className="flex flex-col gap-1.5 sm:flex-row">
                                    <Button size="sm" disabled={pending} onClick={() => setGcashPlan(p)}>
                                      <Smartphone className="h-3.5 w-3.5" /> GCash
                                    </Button>
                                    <Button size="sm" variant="outline" disabled={pending} onClick={() => selectPlan(p.id)}>
                                      Card / e-wallet
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </QueryBoundary>
                        {subscribe.isError || changePlan.isError ? <p className="text-sm text-destructive">Could not {hasExistingSubscription ? 'change plan' : 'subscribe'}. Please try again.</p> : null}
                      </>
                    )}
                  </DialogContent>
                </Dialog>
                {s && !s.cancelAtPeriodEnd ? (
                  <Button variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(undefined, { onError: (err) => toast.fromError(err, 'Could not cancel') })}>
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
