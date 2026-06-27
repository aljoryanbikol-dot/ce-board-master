'use client';
import { useState } from 'react';
import { Dumbbell, ArrowRight, Check, X } from 'lucide-react';
import { studentApi } from '@/features/student/api/student-api';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface PracticeQuestion { id: string; questionId?: string; stemText: string; choices: Array<{ key: string; text: string }>; }
interface PracticeSession { sessionId: string; questions: PracticeQuestion[]; }
interface AnswerResult { correct: boolean; correctChoice: string; explanationText?: string; }

const MODES = [
  { mode: 'recommended', label: 'Recommended', desc: 'Smart mix targeting your weak spots' },
  { mode: 'subject', label: 'By subject', desc: 'Focus a single board subject' },
  { mode: 'mixed', label: 'Mixed', desc: 'A broad spread across topics' },
];

export function PracticeView() {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function start(mode: string) {
    setLoading(true);
    try {
      const s = await studentApi.startPractice({ mode, count: 10 }) as PracticeSession;
      setSession(s); setIdx(0); setSelected(null); setResult(null);
    } catch (err) {
      toast.fromError(err, 'Could not start a practice session');
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!session || !selected) return;
    const q = session.questions[idx];
    if (!q) return;
    setLoading(true);
    try {
      const r = await studentApi.answerPractice(session.sessionId, { questionId: q.questionId ?? q.id, selectedChoice: selected }) as AnswerResult;
      setResult(r);
    } catch (err) {
      toast.fromError(err, 'Could not submit your answer');
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (!session) return;
    if (idx + 1 >= session.questions.length) { setSession(null); toast.success('Practice complete', 'Nice work — your progress is updated.'); return; }
    setIdx((i) => i + 1); setSelected(null); setResult(null);
  }

  if (!session) {
    return (
      <div>
        <PageHeader title="Practice" description="Short, focused sets that adapt to where you need work." />
        <div className="grid gap-4 sm:grid-cols-3">
          {MODES.map((m) => (
            <Card key={m.mode} className="transition-shadow hover:shadow-md">
              <CardHeader><CardTitle className="text-base">{m.label}</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">{m.desc}</p>
                <Button className="w-full" onClick={() => start(m.mode)} disabled={loading}>
                  {loading ? <Spinner className="text-primary-foreground" /> : <>Start <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const q = session.questions[idx];
  if (!q) return <EmptyState icon={Dumbbell} title="No questions in this set" action={{ label: 'Back to practice', onClick: () => setSession(null) }} />;

  return (
    <div>
      <PageHeader title="Practice" description={`Question ${idx + 1} of ${session.questions.length}`} />
      <Card>
        <CardContent className="p-6">
          <p className="font-medium">{q.stemText}</p>
          <div className="mt-5 space-y-2.5">
            {q.choices.map((c) => {
              const isSelected = selected === c.key;
              const isCorrect = result && c.key === result.correctChoice;
              const isWrong = result && isSelected && !result.correct;
              return (
                <button
                  key={c.key}
                  disabled={!!result}
                  onClick={() => setSelected(c.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
                    !result && isSelected && 'border-primary bg-primary/5',
                    !result && !isSelected && 'hover:bg-secondary',
                    isCorrect && 'border-success bg-success/10',
                    isWrong && 'border-destructive bg-destructive/10',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs">{c.key}</span>
                  <span className="flex-1">{c.text}</span>
                  {isCorrect ? <Check className="h-4 w-4 text-success" /> : null}
                  {isWrong ? <X className="h-4 w-4 text-destructive" /> : null}
                </button>
              );
            })}
          </div>

          {result ? (
            <div className="mt-5 rounded-lg border bg-muted/40 p-4">
              <Badge variant={result.correct ? 'success' : 'destructive'}>{result.correct ? 'Correct' : 'Incorrect'}</Badge>
              {result.explanationText ? <p className="mt-2 text-sm text-muted-foreground">{result.explanationText}</p> : null}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            {!result ? (
              <Button onClick={submit} disabled={!selected || loading}>{loading ? <Spinner className="text-primary-foreground" /> : 'Submit answer'}</Button>
            ) : (
              <Button onClick={next}>{idx + 1 >= session.questions.length ? 'Finish' : 'Next question'} <ArrowRight className="h-4 w-4" /></Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
