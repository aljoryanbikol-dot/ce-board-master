'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { billingApi } from '../api/billing-api';

export const useSubscription = () => useQuery({ queryKey: queryKeys.billing.subscription, queryFn: billingApi.subscription });
export const useInvoices = () => useQuery({ queryKey: queryKeys.billing.invoices, queryFn: billingApi.invoices });
