'use client';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export interface Column<T> { key: string; header: string; render: (row: T) => ReactNode; className?: string; }

interface ResourceTableProps<T> {
  title: string;
  description?: string;
  action?: ReactNode;
  isLoading: boolean;
  isError: boolean;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * The single admin list surface. Every admin resource screen renders through
 * this so loading/error/empty/data states and table styling never get
 * re-implemented per page. (No duplicated UI logic.)
 */
export function ResourceTable<T>({ title, description, action, isLoading, isError, rows, columns, rowKey, emptyTitle, emptyDescription }: ResourceTableProps<T>) {
  return (
    <div>
      <PageHeader title={title} description={description} action={action} />
      <QueryBoundary isLoading={isLoading} isError={isError} isEmpty={rows.length === 0} emptyTitle={emptyTitle ?? `No ${title.toLowerCase()} yet`} emptyDescription={emptyDescription}>
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>{columns.map((c) => <TableHead key={c.key} className={c.className}>{c.header}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((c) => <TableCell key={c.key} className={c.className}>{c.render(row)}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </QueryBoundary>
    </div>
  );
}
