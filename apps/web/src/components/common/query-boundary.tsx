'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { LoadingState } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/types';
import { Inbox } from 'lucide-react';

interface QueryBoundaryProps {
  isLoading: boolean;
  isError: boolean;
  /** The query's error object, if available — used to detect a free-tier
   * paywall (FREE_TIER_LIMIT_REACHED) and show an upgrade prompt instead of
   * a generic failure message. */
  error?: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  loadingLabel?: string;
  children: ReactNode;
}

/**
 * One place to render the load → error → empty → data states so every screen
 * handles them the same way (no duplicated UI logic).
 */
export function QueryBoundary({ isLoading, isError, error, isEmpty, emptyTitle = 'Nothing here yet', emptyDescription, loadingLabel, children }: QueryBoundaryProps) {
  if (isLoading) return <LoadingState label={loadingLabel} />;
  if (isError) {
    if (error instanceof ApiError && error.code === 'FREE_TIER_LIMIT_REACHED') {
      return (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-display text-lg font-semibold">This is a Premium feature</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{error.message}</p>
          <Button asChild className="mt-4"><Link href="/subscription">See Premium plans</Link></Button>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">We couldn't load this</p>
        <p className="mt-1 text-muted-foreground">Check your connection and try again. If it persists, the service may be temporarily unavailable.</p>
      </div>
    );
  }
  if (isEmpty) return <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />;
  return <>{children}</>;
}
