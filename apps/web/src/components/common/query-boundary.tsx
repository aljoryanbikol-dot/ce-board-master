'use client';
import type { ReactNode } from 'react';
import { LoadingState } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Inbox } from 'lucide-react';

interface QueryBoundaryProps {
  isLoading: boolean;
  isError: boolean;
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
export function QueryBoundary({ isLoading, isError, isEmpty, emptyTitle = 'Nothing here yet', emptyDescription, loadingLabel, children }: QueryBoundaryProps) {
  if (isLoading) return <LoadingState label={loadingLabel} />;
  if (isError) {
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
