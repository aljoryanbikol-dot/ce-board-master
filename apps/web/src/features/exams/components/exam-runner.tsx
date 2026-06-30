'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, ChevronLeft, ChevronRight, Clock, Send } from 'lucide-react';
import { examsApi } from '../api/exams-api';
import { PageHeader } from '@/components/common/page-header';
import { MathText } from '@/components/common/math-text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState, Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface ExamQuestion { examQuestionId: string; stemText: string; choices: Array<{ key: string; text: string }>; }
interface ExamData { examId: string; durationMinutes: number; questions: ExamQuestion[]; }

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60); const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ExamRunner({ examId }: { examId: string }) {
  const router = useRouter();
  const [exam, setExam] = useState<ExamData | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [remaining, setRemaining] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await examsApi.begin(examId);
        // /exams/:id/questions returns a presented-question ARRAY; /exams/:id has the meta.
        const [meta, qsRaw] = await Promise.all([
          examsApi.get(examId).catch(() => null),
          examsApi.questions(examId),
        ]);
        if (!active) return;
        const arr = Array.isArray(qsRaw) ? qsRaw : ((qsRaw as { questions?: unknown[] })?.questions ?? []);
        const questions: ExamQuestion[] = (arr as Array<Record<string, unknown>>).map((q) => ({
          examQuestionId: String(q.examQuestionId),
          stemText: String(q.stemText ?? ''),
          choices: ((q.choices as Array<{ key?: string; letter?: string; text: string }>) ?? []).map((c) => ({ key: c.key ?? c.letter ?? '', text: c.text })),
        }));
        const durationMinutes = Number((meta as { durationMinutes?: number } | null)?.durationMinutes ?? (qsRaw as { durationMinutes?: number })?.durationMinutes ?? 60);
        setExam({ examId, durationMinutes, questions });
        setRemaining(durationMinutes * 60);
      } catch (err) {
        toast.fromError(err, 'Could not load the exam');
        router.replace('/exams');
      }
    })();
    return () => { active = false; };
  }, [examId, router]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      await examsApi.submit(examId);
      toast.success('Exam submitted', 'Your results are ready.');
      router.replace(`/exams/${examId}/result`);
    } catch (err) {
      toast.fromError(err, 'Could not submit the exam');
      setSubmitting(false);
    }
  }, [examId, router]);

  // Countdown timer with auto-submit at zero.
  useEffect(() => {
    if (!exam || remaining <= 0) return;
    const t = setInterval(() => setRemaining((r) => { if (r <= 1) { clearInterval(t); void submit(); return 0; } return r - 1; }), 1000);
    return () => clearInterval(t);
  }, [exam, remaining, submit]);

  async function choose(eqId: string, choice: string) {
    setAnswers((a) => ({ ...a, [eqId]: choice }));
    try { await examsApi.answer(examId, { examQuestionId: eqId, selectedChoice: choice }); } // autosave
    catch { toast.error('Autosave failed', 'Your answer may not be recorded.'); }
  }

  async function toggleFlag(eqId: string) {
    const next = new Set(flags);
    const willFlag = !next.has(eqId);
    willFlag ? next.add(eqId) : next.delete(eqId);
    setFlags(next);
    try { await examsApi.answer(examId, { examQuestionId: eqId, flagged: willFlag }); } catch { /* non-blocking */ }
  }

  if (!exam) return <LoadingState label="Preparing your exam…" />;
  const q = exam.questions[idx];
  if (!q) return <LoadingState />;
  const answeredCount = Object.keys(answers).length;

  return (
    <div>
      <PageHeader
        title="Mock Exam"
        description={`Question ${idx + 1} of ${exam.questions.length} · ${answeredCount} answered`}
        action={<Badge variant={remaining < 300 ? 'destructive' : 'muted'} className="gap-1 text-sm"><Clock className="h-3.5 w-3.5" />{formatClock(remaining)}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <p className="font-medium"><MathText text={q.stemText} /></p>
              <Button variant="ghost" size="icon" aria-label="Flag question" onClick={() => toggleFlag(q.examQuestionId)}>
                <Flag className={cn('h-4 w-4', flags.has(q.examQuestionId) && 'fill-warning text-warning')} />
              </Button>
            </div>
            <div className="mt-5 space-y-2.5">
              {q.choices.map((c) => {
                const isSelected = answers[q.examQuestionId] === c.key;
                return (
                  <button key={c.key} onClick={() => choose(q.examQuestionId, c.key)} className={cn('flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors', isSelected ? 'border-primary bg-primary/5' : 'hover:bg-secondary')}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs">{c.key}</span>
                    <span><MathText text={c.text} /></span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}><ChevronLeft className="h-4 w-4" /> Previous</Button>
              {idx + 1 < exam.questions.length ? (
                <Button onClick={() => setIdx((i) => i + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
              ) : (
                <Button onClick={submit} disabled={submitting}>{submitting ? <Spinner className="text-primary-foreground" /> : <><Send className="h-4 w-4" /> Submit exam</>}</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Question navigator */}
        <Card className="hidden lg:block">
          <CardContent className="p-4">
            <p className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Navigator</p>
            <div className="grid grid-cols-5 gap-1.5">
              {exam.questions.map((eq, i) => {
                const answered = !!answers[eq.examQuestionId];
                const flagged = flags.has(eq.examQuestionId);
                return (
                  <button key={eq.examQuestionId} onClick={() => setIdx(i)} className={cn('relative flex h-9 items-center justify-center rounded-md border font-mono text-xs transition-colors', i === idx && 'ring-2 ring-ring', answered ? 'bg-primary/15 text-primary' : 'hover:bg-secondary')}>
                    {i + 1}
                    {flagged ? <Flag className="absolute -right-1 -top-1 h-3 w-3 fill-warning text-warning" /> : null}
                  </button>
                );
              })}
            </div>
            <Button className="mt-4 w-full" variant="outline" onClick={submit} disabled={submitting}>Submit early</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
