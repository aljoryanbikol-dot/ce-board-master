'use client';
import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { useRecommendations } from '@/features/student/hooks/use-student';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LearnPage() {
  const recs = useRecommendations();
  const items = (recs.data as Array<{ questionId: string; topicId?: string; reason?: string }> | undefined) ?? [];
  return (
    <div>
      <PageHeader title="Continue Learning" description="Picked for you based on your recent activity and weak spots." action={<Button asChild><Link href="/practice">Practice now <ArrowRight className="h-4 w-4" /></Link></Button>} />
      <QueryBoundary isLoading={recs.isLoading} isError={recs.isError} isEmpty={items.length === 0} emptyTitle="Nothing queued yet" emptyDescription="Answer a few practice questions and we'll line up what to study next.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 9).map((it) => (
            <Card key={it.questionId}>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" /> {it.topicId ? `Topic ${it.topicId.slice(0, 8)}` : 'Recommended set'}</CardTitle></CardHeader>
              <CardContent><p className="mb-4 text-sm text-muted-foreground">{it.reason ?? 'Targeted practice to lift a weak area.'}</p><Button asChild variant="outline" className="w-full"><Link href="/practice">Start</Link></Button></CardContent>
            </Card>
          ))}
        </div>
      </QueryBoundary>
    </div>
  );
}
