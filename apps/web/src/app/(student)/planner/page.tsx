'use client';
import { CalendarRange } from 'lucide-react';
import { usePlanner } from '@/features/student/hooks/use-student';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default function PlannerPage() {
  const { from, to } = monthRange();
  const planner = usePlanner(from, to);
  const items = (planner.data as Array<{ id: string; title: string; date: string; status: string }> | undefined) ?? [];
  return (
    <div>
      <PageHeader title="Study Planner" description="Your scheduled study goals and tasks." />
      <QueryBoundary isLoading={planner.isLoading} isError={planner.isError} isEmpty={items.length === 0} emptyTitle="No study plan yet" emptyDescription="Set goals to build a personalized day-by-day study schedule.">
        <Card><CardContent className="divide-y p-0">
          {items.map((task) => (
            <div key={task.id} className="flex items-center justify-between px-6 py-4 text-sm">
              <span className="flex items-center gap-3"><CalendarRange className="h-4 w-4 text-muted-foreground" /><span>{task.title}</span><span className="text-muted-foreground">{new Date(task.date).toLocaleDateString()}</span></span>
              <Badge variant={task.status === 'completed' ? 'success' : 'muted'}>{task.status}</Badge>
            </div>
          ))}
        </CardContent></Card>
      </QueryBoundary>
    </div>
  );
}
