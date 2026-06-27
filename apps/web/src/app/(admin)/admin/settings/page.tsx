'use client';
import { useAdminSettings } from '@/features/admin/hooks/use-admin';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AdminSettingsPage() {
  const query = useAdminSettings();
  const settings = (query.data as Record<string, unknown> | undefined) ?? {};
  const entries = Object.entries(settings);
  return (
    <div>
      <PageHeader title="System Settings" description="Platform configuration and feature flags." />
      <QueryBoundary isLoading={query.isLoading} isError={query.isError} isEmpty={entries.length === 0} emptyTitle="No settings exposed" emptyDescription="System configuration will appear here.">
        <Card>
          <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {entries.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{k}</span>
                <Badge variant="muted">{String(v)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </QueryBoundary>
    </div>
  );
}
