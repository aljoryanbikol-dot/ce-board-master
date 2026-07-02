/**
 * @file billing-api.ts — wrappers over the subscription/billing endpoints.
 *
 * Routes correspond to SubscriptionController/PlanController
 * (apps/api/src/subscriptions/controllers/subscription.controller.ts) and
 * BillingController (apps/api/src/billing/billing.controller.ts) — there is
 * no `/billing/subscription`, `/billing/plans`, `/billing/change-plan`, or
 * `/billing/cancel` route; only `/billing/invoices` lives under `/billing`.
 */
import { api } from '@/lib/api/client';

export interface Subscription {
  id: string; userId: string; planId: string; status: string;
  currentPeriodStart: string | null; currentPeriodEnd: string | null; trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean; autoRenew: boolean; version: number;
  planName: string | null; tier: string | null;
}
export interface Invoice { id: string; amount: number; currency: string; status: string; issuedAt: string; }
export interface Plan {
  id: string; name: string; slug: string; tier: string; interval: string;
  priceMinor: number; currency: string; durationDays?: number | null;
  trialDays: number; features: string[]; isActive: boolean;
}

export interface SubscribeResult {
  subscription: Subscription;
  payment: { id: string; checkoutUrl: string | null; status: string } | null;
}

export const billingApi = {
  subscription: () => api.data<Subscription | null>(api.get('/subscriptions/me')),
  invoices: () => api.data<Invoice[]>(api.get('/billing/invoices')),
  plans: () => api.data<Plan[]>(api.get('/plans')),
  // POST /subscriptions (not /subscriptions/change) — for a user with no
  // existing subscription yet. Free plans activate immediately (no payment);
  // paid plans return a checkoutUrl the caller must redirect to.
  subscribe: (planId: string) => api.data<SubscribeResult>(api.post('/subscriptions', { planId })),
  changePlan: (planId: string) => api.data(api.post('/subscriptions/change', { planId })),
  cancel: () => api.data(api.post('/subscriptions/cancel', {})),
};
