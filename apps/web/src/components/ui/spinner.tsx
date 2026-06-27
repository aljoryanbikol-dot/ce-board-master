import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Inline loading spinner. */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-muted-foreground', className)} aria-label="Loading" />;
}

/** Full-area loading state. */
export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground', className)} role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span>{label}</span>
    </div>
  );
}
