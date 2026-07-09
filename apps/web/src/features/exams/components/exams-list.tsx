'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Award, Play, History as HistoryIcon, Target, BookOpen, Shuffle, ClipboardList, Trophy, Sun, Sunset } from 'lucide-react';
import { useExamTemplates, useExamHistory } from '../hooks/use-exams';
import { examsApi, type ExamTemplate, type BoardForm } from '../api/exams-api';
import { studentApi } from '@/features/student/api/student-api';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { timeAgo } from '@/lib/utils';

/** PRC paper each subject belongs to (official 3-paper CE board structure). */
const PAPER_BY_SUBJECT_CODE: Record<string, 'MSTE' | 'HGE' | 'PSSEC'> = {
  MATH: 'MSTE', SUR: 'MSTE', TRA: 'MSTE', ECO: 'MSTE', LAW: 'MSTE',
  GEO: 'HGE', HYD: 'HGE', WRE: 'HGE', ENV: 'HGE',
  STR: 'PSSEC', SOM: 'PSSEC', EM: 'PSSEC', CEM: 'PSSEC',
};
const PAPER_ORDER = ['MSTE', 'HGE', 'PSSEC'] as const;

const DIFFICULTY_RE = /\b(Easy|Moderate|Difficult|Comprehensive)\b/;

function difficultyOf(t: ExamTemplate): string | null {
  return t.name.match(DIFFICULTY_RE)?.[1] ?? t.description?.match(DIFFICULTY_RE)?.[1] ?? null;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

/** Sum a template's composition into per-PRC-paper percentages. */
function paperDistribution(t: ExamTemplate, paperBySubjectId: Map<string, string>): Array<{ paper: string; pct: number }> {
  const comp = t.composition ?? [];
  const totals = new Map<string, number>();
  let sum = 0;
  for (const entry of comp) {
    const paper = paperBySubjectId.get(entry.subjectId);
    if (!paper) continue;
    totals.set(paper, (totals.get(paper) ?? 0) + entry.count);
    sum += entry.count;
  }
  if (sum === 0) return [];
  return PAPER_ORDER.filter((p) => totals.has(p)).map((p) => ({ paper: p, pct: Math.round((totals.get(p)! / sum) * 100) }));
}

const PAPER_BAR_CLASS: Record<string, string> = {
  MSTE: 'bg-chart-1', HGE: 'bg-chart-2', PSSEC: 'bg-chart-3',
};

/**
 * 1. PRC Board Exam Experience — the featured section. An educational
 *    simulation inspired by the CE licensure exam format (NOT the official
 *    PRC exam): start the complete two-day experience, or a single day.
 */
function BoardExamExperience({ onStart, creating }: { onStart: (templateId: string, boardDay?: 'day1' | 'day2') => void; creating: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function startRandom(boardDay?: 'day1' | 'day2') {
    const key = boardDay ?? 'complete';
    setBusy(key);
    try {
      const f = await examsApi.randomBoardForm();
      onStart(f.id, boardDay);
    } catch { /* toast handled by onStart path errors */ } finally {
      setBusy(null);
    }
  }

  const options: Array<{ key: string; icon: typeof Trophy; title: string; body: string; day?: 'day1' | 'day2' }> = [
    { key: 'complete', icon: Trophy, title: 'Complete Board Experience', body: 'All 150 items across both simulated exam days — the full preparation experience.' },
    { key: 'day1', icon: Sun, title: 'Day 1', body: 'Morning session — Mathematics, Surveying, Transportation & Economics (MSTE).', day: 'day1' },
    { key: 'day2', icon: Sunset, title: 'Day 2', body: 'Structural Design & Construction (PSSEC) plus Hydraulics & Geotechnical (HGE).', day: 'day2' },
  ];

  return (
    <section>
      <Card className="border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-transparent">
        <CardContent className="p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
            <Trophy className="h-5 w-5 text-amber-500" /> PRC Board Exam Experience
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            An educational simulation inspired by the Civil Engineering Licensure Examination format —
            with the two-day session structure, timing, and passing rules. This is a practice
            simulation from our question bank, not the official PRC examination.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => startRandom(o.day)}
                disabled={busy !== null || creating !== null}
                className="rounded-lg border bg-background p-4 text-left transition-colors hover:border-amber-500/60 disabled:opacity-60"
              >
                <div className="flex items-center justify-between">
                  <o.icon className="h-5 w-5 text-amber-500" />
                  {busy === o.key ? <Spinner /> : <Play className="h-4 w-4 text-muted-foreground" />}
                </div>
                <p className="mt-2 text-sm font-semibold">{o.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{o.body}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * 2. PRC Board Simulations — the 1,000 curated simulation sets from the
 *    Content SDK, each a fixed 150-item practice examination patterned after
 *    the PRC day/session structure. Paginated browser + one-click random set.
 */
function BoardSimulationSets({ onStart, creating }: { onStart: (templateId: string) => void; creating: string | null }) {
  const [page, setPage] = useState(1);
  const forms = useQuery({
    queryKey: ['exams', 'board-forms', page],
    queryFn: () => examsApi.boardForms(page, 12),
    placeholderData: keepPreviousData,
  });
  const [randomBusy, setRandomBusy] = useState(false);
  const total = forms.data?.total ?? 0;
  if (!forms.isLoading && total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / 12));

  async function startRandom() {
    setRandomBusy(true);
    try {
      const f = await examsApi.randomBoardForm();
      onStart(f.id);
    } catch { /* toast handled by onStart path errors */ } finally {
      setRandomBusy(false);
    }
  }

  return (
    <section>
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
                <ClipboardList className="h-5 w-5 text-primary" /> PRC Board Simulations
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {total.toLocaleString()} board simulation sets patterned after the PRC structure — Day 1 Morning (MSTE),
                Day 2 Morning (PSSEC), Day 2 Afternoon (HGE). 150 items each, fixed order, graduated difficulty.
              </p>
            </div>
            <Button onClick={startRandom} disabled={randomBusy || creating !== null}>
              {randomBusy ? <Spinner className="text-primary-foreground" /> : <><Shuffle className="h-4 w-4" /> Start a random set</>}
            </Button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(forms.data?.items ?? []).map((f: BoardForm) => (
              <button
                key={f.id}
                onClick={() => onStart(f.id)}
                disabled={creating !== null}
                className="rounded-lg border bg-background p-3 text-left text-sm transition-colors hover:border-primary/60 disabled:opacity-60"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold">{f.code.replace('CE-PRCFORM-', 'Set ')}</span>
                  {creating === f.id ? <Spinner /> : <Play className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="mt-1 text-2xs text-muted-foreground">
                  {f.totalQuestions} items · {formatDuration(f.durationMinutes)} · pass {f.passingScore}%
                </p>
              </button>
            ))}
          </div>

          {pages > 1 ? (
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Sets page {page} of {pages}</span>
              <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

export function ExamsList() {
  const router = useRouter();
  const templates = useExamTemplates();
  const history = useExamHistory();
  const [creating, setCreating] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Array<{ id: string; code: string; name: string }>>([]);

  useEffect(() => {
    studentApi.practiceSubjects().then((s) => setSubjects(s)).catch(() => {});
  }, []);

  const paperBySubjectId = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subjects) {
      const paper = PAPER_BY_SUBJECT_CODE[s.code];
      if (paper) m.set(s.id, paper);
    }
    return m;
  }, [subjects]);

  const all = (templates.data ?? []) as ExamTemplate[];

  // ── Three-tier classification (presentation only) ─────────────────────────
  // 1. PRC Board Simulations — flagship full-board / per-paper simulations.
  // 2. Subject Mock Exams — full subject mocks and tiered subject exams,
  //    grouped by subject (mixed-subject paper mocks form their own group).
  // 3. Topic Mock Exams — category quizzes and focus drills.
  const { boardSims, subjectGroups, topicGroups } = useMemo(() => {
    const board: ExamTemplate[] = [];
    const subject: ExamTemplate[] = [];
    const topic: ExamTemplate[] = [];
    for (const t of all) {
      if (t.kind === 'full_board') board.push(t);
      else if (t.code.includes('-CAT-') || /Focus Drill/i.test(t.name)) topic.push(t);
      else subject.push(t);
    }
    board.sort((a, b) => a.code.localeCompare(b.code));

    const groupOf = (t: ExamTemplate) => (t.kind === 'custom' ? 'Mixed-Subject Papers' : (t.name.split(' — ')[0] ?? t.name));
    const groupBy = (list: ExamTemplate[]) => {
      const groups = new Map<string, ExamTemplate[]>();
      for (const t of list) {
        const g = groupOf(t);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(t);
      }
      return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    };
    return { boardSims: board, subjectGroups: groupBy(subject), topicGroups: groupBy(topic) };
  }, [all]);

  async function startExam(templateId: string, kind: string, boardDay?: 'day1' | 'day2') {
    setCreating(templateId);
    try {
      const exam = await examsApi.create({ kind, templateId, boardDay }) as { examId: string };
      router.push(`/exams/${exam.examId}`);
    } catch (err) {
      toast.fromError(err, 'Could not create the exam');
    } finally {
      setCreating(null);
    }
  }

  const historyRows = (history.data as Array<{ examId: string; templateName?: string; scorePercent?: number; status: string; submittedAt?: string }> | undefined) ?? [];

  const startButton = (t: ExamTemplate, label = 'Begin exam') => (
    <Button className="w-full" onClick={() => startExam(t.id, t.kind)} disabled={creating === t.id}>
      {creating === t.id ? <Spinner className="text-primary-foreground" /> : <><Play className="h-4 w-4" /> {label}</>}
    </Button>
  );

  return (
    <div>
      <PageHeader title="Mock Exams" description="Board exam experience, board simulations, subject mock exams, and topic drills — with board-style timing and scoring." />
      <Tabs defaultValue="available">
        <TabsList>
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="available">
          <QueryBoundary isLoading={templates.isLoading} isError={templates.isError} isEmpty={all.length === 0} emptyTitle="No exam templates yet" emptyDescription="Check back soon — new mock boards are added regularly.">
            <div className="space-y-10">

              {/* ── 1. PRC Board Exam Experience (featured) ──────────────── */}
              <BoardExamExperience onStart={(templateId, boardDay) => startExam(templateId, 'full_board', boardDay)} creating={creating} />

              {/* ── 2. PRC Board Simulations — 1,000 simulation sets ─────── */}
              <BoardSimulationSets onStart={(templateId) => startExam(templateId, 'full_board')} creating={creating} />

              {/* ── 2b. Engineered simulation papers ─────────────────────── */}
              {boardSims.length > 0 && (
                <section>
                  <div className="mb-1 flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    <h2 className="font-display text-lg font-semibold tracking-tight">Engineered Simulation Papers</h2>
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Practice examinations patterned after the PRC three-paper structure — MSTE, HGE, and PSSEC — with board-style timing, difficulty, and passing rules.
                  </p>
                  <div className="grid gap-5 md:grid-cols-2">
                    {boardSims.map((t, i) => {
                      const dist = paperDistribution(t, paperBySubjectId);
                      const difficulty = difficultyOf(t);
                      return (
                        <Card key={t.id} className="border-primary/40 shadow-sm">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-2xs font-medium uppercase tracking-wider text-primary">Board Simulation No. {String(i + 1).padStart(2, '0')}</p>
                                <CardTitle className="mt-1 text-base leading-snug">{t.name}</CardTitle>
                              </div>
                              <Badge className="shrink-0">Board Simulation</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <dl className="mb-3 grid grid-cols-4 gap-2 text-sm text-muted-foreground">
                              <div><dt className="text-2xs uppercase tracking-wider">Questions</dt><dd className="font-mono text-foreground">{t.totalQuestions}</dd></div>
                              <div><dt className="text-2xs uppercase tracking-wider">Time limit</dt><dd className="font-mono text-foreground">{formatDuration(t.durationMinutes)}</dd></div>
                              <div><dt className="text-2xs uppercase tracking-wider">Passing</dt><dd className="font-mono text-foreground">{t.passingScore}%</dd></div>
                              <div><dt className="text-2xs uppercase tracking-wider">Difficulty</dt><dd className="text-foreground">{difficulty ?? 'Board-level'}</dd></div>
                            </dl>
                            {dist.length > 0 && (
                              <div className="mb-4">
                                <p className="mb-1 text-2xs uppercase tracking-wider text-muted-foreground">PRC paper distribution</p>
                                <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                                  {dist.map((d) => (
                                    <div key={d.paper} className={PAPER_BAR_CLASS[d.paper] ?? 'bg-primary'} style={{ width: `${d.pct}%` }} title={`${d.paper} ${d.pct}%`} />
                                  ))}
                                </div>
                                <div className="mt-1 flex gap-3 text-2xs text-muted-foreground">
                                  {dist.map((d) => <span key={d.paper}>{d.paper} {d.pct}%</span>)}
                                </div>
                              </div>
                            )}
                            {startButton(t, 'Begin board simulation')}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── 2. Subject Mock Exams ────────────────────────────────── */}
              {subjectGroups.length > 0 && (
                <section>
                  <div className="mb-1 flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                    <h2 className="font-display text-lg font-semibold tracking-tight">Subject Mock Exams</h2>
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground">Full-length mock exams for each subject, from easy to comprehensive.</p>
                  <div className="space-y-6">
                    {subjectGroups.map(([group, list]) => (
                      <div key={group}>
                        <h3 className="mb-2 text-sm font-medium text-muted-foreground">{group}</h3>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {list.map((t) => {
                            const difficulty = difficultyOf(t);
                            return (
                              <Card key={t.id}>
                                <CardHeader className="pb-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <CardTitle className="text-sm leading-snug">{t.name.includes(' — ') ? t.name.split(' — ').slice(1).join(' — ') : t.name}</CardTitle>
                                    {difficulty ? <Badge variant="muted" className="shrink-0">{difficulty}</Badge> : null}
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <dl className="mb-4 grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                                    <div><dt className="text-2xs uppercase tracking-wider">Questions</dt><dd className="font-mono text-foreground">{t.totalQuestions}</dd></div>
                                    <div><dt className="text-2xs uppercase tracking-wider">Time</dt><dd className="font-mono text-foreground">{formatDuration(t.durationMinutes)}</dd></div>
                                    <div><dt className="text-2xs uppercase tracking-wider">Passing</dt><dd className="font-mono text-foreground">{t.passingScore}%</dd></div>
                                  </dl>
                                  {startButton(t)}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── 3. Topic Mock Exams ──────────────────────────────────── */}
              {topicGroups.length > 0 && (
                <section>
                  <div className="mb-1 flex items-center gap-2">
                    <Target className="h-5 w-5 text-muted-foreground" />
                    <h2 className="font-display text-lg font-semibold tracking-tight">Topic Drills</h2>
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground">Focused practice by topic — sharpen weak areas before a full simulation.</p>
                  <div className="space-y-6">
                    {topicGroups.map(([group, list]) => (
                      <div key={group}>
                        <h3 className="mb-2 text-sm font-medium text-muted-foreground">{group}</h3>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {list.map((t) => (
                            <Card key={t.id}>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm leading-snug">{t.name.includes(' — ') ? t.name.split(' — ').slice(1).join(' — ') : t.name}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <dl className="mb-4 grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                                  <div><dt className="text-2xs uppercase tracking-wider">Questions</dt><dd className="font-mono text-foreground">{t.totalQuestions}</dd></div>
                                  <div><dt className="text-2xs uppercase tracking-wider">Time</dt><dd className="font-mono text-foreground">{formatDuration(t.durationMinutes)}</dd></div>
                                  <div><dt className="text-2xs uppercase tracking-wider">Passing</dt><dd className="font-mono text-foreground">{t.passingScore}%</dd></div>
                                </dl>
                                {startButton(t, 'Start drill')}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
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
