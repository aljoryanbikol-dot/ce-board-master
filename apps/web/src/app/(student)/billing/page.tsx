'use client';
import { useInvoices } from '@/features/billing/hooks/use-billing';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatMoney } from '@/lib/utils';

export default function BillingPage() {
  const invoices = useInvoices();
  const rows = invoices.data ?? [];
  return (
    <div>
      <PageHeader title="Billing" description="Your invoices and payment history." />
      <QueryBoundary isLoading={invoices.isLoading} isError={invoices.isError} isEmpty={rows.length === 0} emptyTitle="No invoices yet" emptyDescription="Invoices appear here after your first payment.">
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.id.slice(0, 10)}</TableCell>
                  <TableCell className="font-mono">{formatMoney(inv.amount, inv.currency)}</TableCell>
                  <TableCell><Badge variant={inv.status === 'paid' ? 'success' : 'warning'}>{inv.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(inv.issuedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </QueryBoundary>
    </div>
  );
}
