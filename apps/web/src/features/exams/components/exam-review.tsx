'use client';
/**
 * Premium post-exam Review Mode. For every question: the student's answer vs
 * the correct one, the step-by-step engineering solution, formulas used,
 * engineering notes, the AI-tutor explanation, common mistakes, board tips,
 * and the question's figure — filterable by all / incorrect / skipped /
 * bookmarked, with the exam summary up top.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, Sigma, Wrench, Bot, AlertTriangle, Lightbulb, Clock } from 'lucide-react';
import { examsApi } from '../api/exams-api';
import { useExamResult } from '../hooks/use-exams';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { MathText } from '@/components/common/math-text';
import { DiagramImage, type DiagramImageData } from '@/components/common/diagram-image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPercent, cn } from '@/lib/utils';

type ReviewFilter = 'all' | 'incorrect' | 'skipped' | 'bookmarked';

interface ReviewItem {
  examQuestionId: string; position: number; stemText: string;
  subjectName: string | null; topicName: string | null;
  choices: Array<{ letter: string; text: string; isCorrect: boolean }>;
  selectedChoice: string | null; correctChoicePresented: string | null;
  isCorrect: boolean | null; wasAnswered: boolean; timeSpentSec: number | null;
  explanation: string | null;
  engineeringNotes: string | null;
  aiTutorExplanation: string | null;
  commonMistakes: string[];
  boardTips: string[];
  timeSavingTips: string | null;
  formulas: Array<{ name: string; slug: string; latex: string | null; text: string | null; isPrimary: boolean }>;
  diagram: DiagramImageData | null;
}

function Section({ icon: Icon, title, tone, children }: { icon: typeof Sigma; title: string; tone?: 'default' | 'warning' | 'primary'; children: React.ReactNode }) {
  return (
    <div className={cn('mt-4 rounded-lg border p-4', tone === 'warning' && 'border-warning/40 bg-warning/5', tone === 'primary' && 'border-primary/40 bg-primary/5')}>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function ExamReviewView({ examId }: { examId: string }) {
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const result = useExamResult(examId);
  const review = useQuery({
    queryKey: ['exams', examId, 'review', filter],
    queryFn: () => examsApi.review(examId, filter),
  });

  const r = result.data as { scorePercent?: number; correctCount?: number; totalQuestions?: number; passed?: boolean } | undefined;
  const data = review.data as { count: number; items: ReviewItem[] } | undefined;

  return (
    <div>
      <PageHeader
        title="Exam Review"
        description="Every question with its complete engineering solution."
        action={<Button asChild variant="outline"><Link href={`/exams/${examId}/result`}><ArrowLeft className="h-4 w-4" /> Back to result</Link></Button>}
      />

      {r ? (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 p-4 text-sm">
            <span className="font-mono text-2xl font-semibold">{formatPercent(r.scorePercent ?? 0)}</span>
            <Badge variant={r.passed ? 'success' : 'warning'}>{r.passed ? 'Passed' : 'Below passing'}</Badge>
            <span className="text-muted-foreground">{r.correctCount}/{r.totalQuestions} correct · passing line 70%</span>
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={filter} onValueChange={(v) => setFilter(v as ReviewFilter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="incorrect">Incorrect</TabsTrigger>
          <TabsTrigger value="skipped">Skipped</TabsTrigger>
          <TabsTrigger value="bookmarked">Bookmarked</TabsTrigger>
        </TabsList>
      </Tabs>

      <QueryBoundary isLoading={review.isLoading} isError={review.isError} isEmpty={!data || data.items.length === 0} emptyTitle="Nothing here" emptyDescription="No questions match this filter.">
        <div className="mt-4 space-y-6">
          {(data?.items ?? []).map((q) => (
            <Card key={q.examQuestionId}>
              <CardContent className="p-6">
                {/* Header: number, subject/topic, verdict */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">#{q.position + 1}</span>
                  {q.subjectName ? <Badge variant="muted">{q.subjectName}</Badge> : null}
                  {q.topicName ? <Badge variant="muted">{q.topicName}</Badge> : null}
                  {q.isCorrect === true ? (
                    <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Correct</Badge>
                  ) : q.wasAnswered ? (
                    <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Incorrect</Badge>
                  ) : (
                    <Badge variant="warning" className="gap-1"><MinusCircle className="h-3 w-3" /> Skipped</Badge>
                  )}
                  {q.timeSpentSec != null && q.timeSpentSec > 0 ? (
                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{q.timeSpentSec}s</span>
                  ) : null}
                </div>

                <p className="font-medium"><MathText text={q.stemText} /></p>
                <DiagramImage diagram={q.diagram} />

                {/* Choices: correct highlighted green; wrong pick highlighted red */}
                <div className="mt-4 space-y-2">
                  {q.choices.map((c) => {
                    const isStudentPick = q.selectedChoice === c.letter;
                    return (
                      <div key={c.letter} className={cn('flex items-center gap-3 rounded-lg border p-2.5 text-sm',
                        c.isCorrect && 'border-success bg-success/10',
                        isStudentPick && !c.isCorrect && 'border-destructive bg-destructive/10')}>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs">{c.letter}</span>
                        <span className="flex-1"><MathText text={c.text} /></span>
                        {c.isCorrect ? <Badge variant="success">Correct answer</Badge> : null}
                        {isStudentPick && !c.isCorrect ? <Badge variant="destructive">Your answer</Badge> : null}
                        {isStudentPick && c.isCorrect ? <Badge variant="success">Your answer</Badge> : null}
                      </div>
                    );
                  })}
                </div>

                {q.explanation ? (
                  <Section icon={Wrench} title="Step-by-step solution" tone="primary">
                    <MathText text={q.explanation} />
                  </Section>
                ) : null}

                {q.formulas.length > 0 ? (
                  <Section icon={Sigma} title="Formulas used">
                    {q.formulas.map((f) => (
                      <div key={f.name} className="rounded-md bg-secondary/50 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">{f.name}{f.isPrimary ? ' · primary' : ''}</p>
                          <Link href={`/handbook/formula/${f.slug}`} className="shrink-0 text-xs font-medium text-primary hover:underline">
                            Open in Handbook
                          </Link>
                        </div>
                        <p className="font-mono text-sm"><MathText text={f.latex ?? f.text ?? ''} /></p>
                      </div>
                    ))}
                  </Section>
                ) : null}

                {q.engineeringNotes ? (
                  <Section icon={Wrench} title="Engineering notes">
                    <MathText text={q.engineeringNotes} />
                  </Section>
                ) : null}

                {q.aiTutorExplanation ? (
                  <Section icon={Bot} title="AI tutor explanation">
                    <MathText text={q.aiTutorExplanation} />
                  </Section>
                ) : null}

                {q.commonMistakes.length > 0 ? (
                  <Section icon={AlertTriangle} title="Common mistakes" tone="warning">
                    <ul className="list-disc space-y-1 pl-5">
                      {q.commonMistakes.map((m, i) => <li key={i}><MathText text={m} /></li>)}
                    </ul>
                  </Section>
                ) : null}

                {q.boardTips.length > 0 || q.timeSavingTips ? (
                  <Section icon={Lightbulb} title="Board tips">
                    <ul className="list-disc space-y-1 pl-5">
                      {q.boardTips.map((t, i) => <li key={i}>{t}</li>)}
                      {q.timeSavingTips ? <li>{q.timeSavingTips}</li> : null}
                    </ul>
                  </Section>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryBoundary>
    </div>
  );
}
