import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: 'primary' | 'accent' | 'success' | 'warning';
}

const accentMap = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/15 text-accent-foreground',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
};

/** A KPI tile. Mono numerals nod to the engineering/measurement theme. */
export function StatCard({ label, value, hint, icon: Icon, accent = 'primary' }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        {Icon ? (
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', accentMap[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-mono text-2xl font-semibold leading-tight">{value}</p>
          {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
