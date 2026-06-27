'use client';
import { useHistory } from '@/features/student/hooks/use-student';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { timeAgo } from '@/lib/utils';

export default function HistoryPage() {
  const history = useHistory();
  const rows = (history.data as Array<{ id: string; questionCode?: string; outcome: string; answeredAt: string }> | undefined) ?? [];
  return (
    <div>
      <PageHeader title="Question History" description="Every question you've attempted." />
      <QueryBoundary isLoading={history.isLoading} isError={history.isError} isEmpty={rows.length === 0} emptyTitle="No history yet" emptyDescription="Your answered questions will be logged here.">
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Outcome</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.questionCode ?? r.id.slice(0, 8)}</TableCell>
                  <TableCell><Badge variant={r.outcome === 'correct' ? 'success' : r.outcome === 'incorrect' ? 'destructive' : 'muted'}>{r.outcome}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(r.answeredAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </QueryBoundary>
    </div>
  );
}
