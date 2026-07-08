'use client';
/**
 * Printable quick-review sheet for one subject: every formula with its
 * expression and variables, print-optimized (use the Print button or the
 * browser's Print → Save as PDF for a downloadable copy).
 */
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { handbookApi } from '../api/handbook-api';
import { QueryBoundary } from '@/components/common/query-boundary';
import { MathText } from '@/components/common/math-text';
import { Button } from '@/components/ui/button';

export function ReviewSheetView({ subjectCode }: { subjectCode: string }) {
  const formulas = useQuery({
    queryKey: ['handbook', 'sheet', subjectCode],
    queryFn: () => handbookApi.formulas({ subjectCode, limit: 50, page: 1 }),
  });
  const subjects = useQuery({ queryKey: ['handbook', 'subjects'], queryFn: handbookApi.subjects });
  const subjectName = subjects.data?.find((s) => s.code === subjectCode)?.name ?? subjectCode;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button asChild variant="outline"><Link href="/handbook"><ArrowLeft className="h-4 w-4" /> Handbook</Link></Button>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save PDF</Button>
      </div>

      <div className="print:text-black">
        <h1 className="font-display text-xl font-semibold">{subjectName} — Quick Review Sheet</h1>
        <p className="mb-4 text-xs text-muted-foreground print:text-gray-600">CE Board Master · Fundamentals Handbook</p>

        <QueryBoundary isLoading={formulas.isLoading} isError={formulas.isError} isEmpty={(formulas.data?.items.length ?? 0) === 0} emptyTitle="No formulas" emptyDescription="This subject has no formulas yet.">
          <div className="columns-1 gap-4 sm:columns-2">
            {(formulas.data?.items ?? []).map((f) => (
              <div key={f.slug} className="mb-3 break-inside-avoid rounded-lg border p-3">
                <p className="text-xs font-semibold">{f.name}</p>
                <p className="mt-1 font-mono text-xs"><MathText text={f.expressionLatex || f.expressionText} /></p>
              </div>
            ))}
          </div>
        </QueryBoundary>
      </div>
    </div>
  );
}
