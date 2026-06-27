'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FileText, Play, History as HistoryIcon } from 'lucide-react';
import { useExamTemplates, useExamHistory } from '../hooks/use-exams';
import { examsApi } from '../api/exams-api';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { timeAgo } from '@/lib/utils';

export function ExamsList() {
  const router = useRouter();
  const templates = useExamTemplates();
  const history = useExamHistory();
  const [creating, setCreating] = useState<string | null>(null);

  async function startExam(templateId: string, kind: string) {
    setCreating(templateId);
    try {
      const exam = await examsApi.create({ kind, templateId }) as { examId: string };
      router.push(`/exams/${exam.examId}`);
    } catch (err) {
      toast.fromError(err, 'Could not create the exam');
    } finally {
      setCreating(null);
    }
  }

  const historyRows = (history.data as Array<{ examId: string; templateName?: string; scorePercent?: number; status: string; submittedAt?: string }> | undefined) ?? [];

  return (
    <div>
      <PageHeader title="Mock Exams" description="Full board simulations under real timing and scoring." />
      <Tabs defaultValue="available">
        <TabsList>
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="available">
          <QueryBoundary isLoading={templates.isLoading} isError={templates.isError} isEmpty={!templates.data || (templates.data as unknown[]).length === 0} emptyTitle="No exam templates yet" emptyDescription="Check back soon — new mock boards are added regularly.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(templates.data ?? []).map((t) => (
                <Card key={t.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      <Badge variant="muted">{t.kind}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <dl className="mb-4 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div><dt className="text-2xs uppercase tracking-wider">Questions</dt><dd className="font-mono text-foreground">{t.totalQuestions}</dd></div>
                      <div><dt className="text-2xs uppercase tracking-wider">Minutes</dt><dd className="font-mono text-foreground">{t.durationMinutes}</dd></div>
                      <div><dt className="text-2xs uppercase tracking-wider">Passing</dt><dd className="font-mono text-foreground">{t.passingScore}%</dd></div>
                    </dl>
                    <Button className="w-full" onClick={() => startExam(t.id, t.kind)} disabled={creating === t.id}>
                      {creating === t.id ? <Spinner className="text-primary-foreground" /> : <><Play className="h-4 w-4" /> Begin exam</>}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </QueryBoundary>
        </TabsContent>

        <TabsContent value="history">
          <QueryBoundary isLoading={history.isLoading} isError={history.isError} isEmpty={historyRows.length === 0} emptyTitle="No exams taken yet" emptyDescription="Your completed mock boards and scores will appear here.">
            <Card>
              <CardContent className="divide-y p-0">
                {historyRows.map((h) => (
                  <button key={h.examId} onClick={() => router.push(`/exams/${h.examId}/result`)} className="flex w-full items-center justify-between px-6 py-4 text-left text-sm transition-colors hover:bg-secondary">
                    <span className="flex items-center gap-3"><HistoryIcon className="h-4 w-4 text-muted-foreground" /><span>{h.templateName ?? 'Mock exam'}</span>{h.submittedAt ? <span className="text-muted-foreground">{timeAgo(h.submittedAt)}</span> : null}</span>
                    {typeof h.scorePercent === 'number' ? <Badge variant={h.scorePercent >= 70 ? 'success' : 'warning'}>{h.scorePercent}%</Badge> : <Badge variant="muted">{h.status}</Badge>}
                  </button>
                ))}
              </CardContent>
            </Card>
          </QueryBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
