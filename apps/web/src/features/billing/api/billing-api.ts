/**
 * @file billing-api.ts — wrappers over the subscription/billing endpoints (Sprint 2.4).
 */
import { api } from '@/lib/api/client';

export interface Subscription { tier: string; status: string; renewsAt?: string; cancelAtPeriodEnd?: boolean; }
export interface Invoice { id: string; amount: number; currency: string; status: string; issuedAt: string; }

export const billingApi = {
  subscription: () => api.data<Subscription>(api.get('/billing/subscription')),
  invoices: () => api.data<Invoice[]>(api.get('/billing/invoices')),
  plans: () => api.data(api.get('/billing/plans')),
  changePlan: (planId: string) => api.data(api.post('/billing/change-plan', { planId })),
  cancel: () => api.data(api.post('/billing/cancel')),
};
