'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { billingApi } from '../api/billing-api';

export const useSubscription = () => useQuery({ queryKey: queryKeys.billing.subscription, queryFn: billingApi.subscription });
export const useInvoices = () => useQuery({ queryKey: queryKeys.billing.invoices, queryFn: billingApi.invoices });
export const usePlans = () => useQuery({ queryKey: queryKeys.billing.plans, queryFn: billingApi.plans });

export function useSubscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => billingApi.subscribe(planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.subscription }),
  });
}

export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => billingApi.changePlan(planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.subscription }),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => billingApi.cancel(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.subscription }),
  });
}
