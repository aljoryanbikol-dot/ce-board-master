/**
 * @file ai-tutor.integration.spec.ts
 * @module AITutor/Integration
 *
 * Wires the REAL AI Tutor services together (TutorContextService,
 * GroundingValidationService, ConversationService, ExplanationService,
 * HintService, SolutionService, FormulaAssistantService, AITutorService) plus the
 * DeterministicTutorProvider and the real ProgressTrackingService /
 * QuestionRecommendationService from the Student Platform, over an in-memory
 * persistence double. Exercises: a multi-turn grounded conversation, a hint that
 * never reveals the answer, a step-by-step solution, formula assistance, and
 * smart recommendations — verifying KB grounding + citations end-to-end.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TutorContextService } from '../../src/ai-tutor/services/tutor-context.service';
import { GroundingValidationService } from '../../src/ai-tutor/services/grounding-validation.service';
import { ConversationService } from '../../src/ai-tutor/services/conversation.service';
import { ExplanationService } from '../../src/ai-tutor/services/explanation.service';
import { HintService } from '../../src/ai-tutor/services/hint.service';
import { SolutionService } from '../../src/ai-tutor/services/solution.service';
import { FormulaAssistantService } from '../../src/ai-tutor/services/formula-assistant.service';
import { RecommendationService } from '../../src/ai-tutor/services/recommendation.service';
import { AITutorService } from '../../src/ai-tutor/services/ai-tutor.service';
import { DeterministicTutorProvider } from '../../src/ai-tutor/providers/deterministic-tutor.provider';
import { ProgressTrackingService } from '../../src/student/services/progress-tracking.service';
import { QuestionRecommendationService } from '../../src/student/services/question-recommendation.service';

function makeInMemoryPrisma() {
  const db = {
    subjects: [{ id: 's-1', code: 'MAT' }] as any[],
    questions: [{ id: 'q-1', questionCode: 'MAT-1', subjectId: 's-1', topicId: 't-1', stemText: 'Find the current through a 10Ω resistor at 20V.', correctChoice: 'B', explanationText: 'Apply Ohm law: I = V/R.', questionStatus: 'published', deletedAt: null }] as any[],
    los: [{ publicId: 'LO-MAT-1', statement: 'Apply Ohm law to resistive circuits', subjectCode: 'MAT', status: 'published', sequenceNumber: 1 }] as any[],
    formulas: [{ id: 'f-1', name: "Ohm's Law", expressionText: 'V=IR', expressionLatex: 'V=IR', subjectId: 's-1', topicId: 't-1', isActive: true }] as any[],
    misconceptions: [{ publicId: 'MIS-1', title: 'Resistance Inversion', description: 'Students invert V and R.', subjectCode: 'MAT', status: 'published' }] as any[],
    conversations: [] as any[],
    messages: [] as any[],
    citations: [] as any[],
    mastery: [] as any[],
    attempts: [] as any[],
    gaps: [] as any[],
  };
  let seq = 0;
  const uid = (p: string) => `${p}-${++seq}`;

  const prisma: any = {
    $transaction: async (fn: any) => fn(prisma),
    subject: { findUnique: async ({ where }: any) => db.subjects.find((s) => s.id === where.id) ?? null },
    question: { findFirst: async ({ where }: any) => db.questions.find((q) => q.id === where.id && q.deletedAt === null) ?? null, findMany: async ({ where }: any) => db.questions.filter((q) => q.questionStatus === 'published' && q.deletedAt === null && (!where?.topicId || q.topicId === where.topicId) && (!where?.subjectId || q.subjectId === where.subjectId)) },
    learningObjective: { findMany: async ({ where }: any) => db.los.filter((l) => l.subjectCode === where.subjectCode && l.status === 'published') },
    formulaLibrary: { findMany: async ({ where }: any) => db.formulas.filter((f) => f.isActive && (!where.subjectId || f.subjectId === where.subjectId) && (!where.OR || where.OR.some((o: any) => (o.name?.contains && f.name.toLowerCase().includes(o.name.contains.toLowerCase())) || (o.expressionText?.contains && f.expressionText.toLowerCase().includes(o.expressionText.contains.toLowerCase()))))) },
    misconception: { findMany: async ({ where }: any) => db.misconceptions.filter((m) => m.status === 'published' && (!where.subjectCode || m.subjectCode === where.subjectCode)) },
    tutorConversation: {
      create: async ({ data }: any) => { const c = { id: uid('c'), ...data, status: 'active', messageCount: 0, lastMessageAt: null, memorySummary: null, createdAt: new Date() }; db.conversations.push(c); return c; },
      findUnique: async ({ where }: any) => db.conversations.find((c) => c.id === where.id) ?? null,
      findMany: async ({ where }: any) => db.conversations.filter((c) => c.userId === where.userId),
      update: async ({ where, data }: any) => { const c = db.conversations.find((x) => x.id === where.id); Object.assign(c, data, data.messageCount?.increment ? { messageCount: c.messageCount + data.messageCount.increment } : {}); return c; },
    },
    tutorMessage: {
      create: async ({ data, include }: any) => { const cites = data.citations?.create ?? []; const m = { id: uid('m'), ...data, createdAt: new Date(), citations: include?.citations ? cites.map((c: any) => ({ id: uid('cit'), ...c })) : undefined }; db.messages.push(m); for (const c of cites) db.citations.push({ id: uid('cit'), messageId: m.id, ...c }); return m; },
      findMany: async ({ where, orderBy, take }: any) => { let rows = db.messages.filter((m) => m.conversationId === where.conversationId); rows = rows.sort((a, b) => a.createdAt - b.createdAt); if (orderBy?.createdAt === 'desc') rows = rows.reverse(); return take ? rows.slice(0, take) : rows; },
    },
    // ProgressTrackingService deps
    topicMastery: {
      findUnique: async ({ where }: any) => db.mastery.find((m) => m.userId === where.userId_topicId.userId && m.topicId === where.userId_topicId.topicId) ?? null,
      upsert: async ({ where, create, update }: any) => { const ex = db.mastery.find((m) => m.userId === where.userId_topicId.userId && m.topicId === where.userId_topicId.topicId); if (ex) { Object.assign(ex, update); return ex; } const m = { id: uid('tm'), ...create }; db.mastery.push(m); return m; },
      findMany: async ({ where }: any) => db.mastery.filter((m) => m.userId === where.userId && (where.attempts?.gte === undefined || m.attempts >= where.attempts.gte) && (where.accuracy?.lt === undefined || m.accuracy < where.accuracy.lt)),
      count: async () => 0,
    },
    knowledgeGap: { findMany: async ({ where }: any) => db.gaps.filter((g) => g.userId === where.userId), upsert: async () => ({}), updateMany: async () => ({}) },
    questionAttempt: { findMany: async () => db.attempts, count: async () => db.attempts.length },
  };
  return { prisma, db };
}

function harness() {
  const { prisma, db } = makeInMemoryPrisma();
  const cache = { del: async () => {}, remember: async (_k: string, _t: number, fn: () => unknown) => fn() };
  const events = { emit: () => {} };
  const provider = new DeterministicTutorProvider();
  const context = new TutorContextService(prisma as never, cache as never);
  const grounding = new GroundingValidationService();
  const conversations = new ConversationService(prisma as never, cache as never, events as never);
  const explanation = new ExplanationService(prisma as never, context, grounding, provider, events as never);
  const hints = new HintService(prisma as never, context, provider, events as never);
  const solution = new SolutionService(prisma as never, context, provider, events as never);
  const formulas = new FormulaAssistantService(prisma as never, context, provider);
  const progress = new ProgressTrackingService(prisma as never, events as never);
  const studentRecs = new QuestionRecommendationService(prisma as never);
  const recommendations = new RecommendationService(progress, studentRecs);
  const tutor = new AITutorService(conversations, context, explanation, solution, hints, formulas, grounding, provider, events as never);
  return { prisma, db, context, conversations, explanation, hints, solution, formulas, recommendations, tutor };
}

describe('AI Tutor — integration (real services)', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); });

  it('multi-turn grounded conversation persists messages + citations', async () => {
    const started = await h.tutor.startConversation('u-1', { subjectId: 's-1', topicId: 't-1', firstMessage: 'Explain Ohm law' });
    expect(started.conversation.id).toBeDefined();
    expect(started.firstAnswer).not.toBeNull();

    // A second turn (follow-up).
    const answer2 = await h.tutor.sendMessage('u-1', started.conversation.id, { message: 'What formula do I use?' } as never);
    expect(answer2.content.length).toBeGreaterThan(0);

    // Messages persisted (2 turns => 4 messages: user+assistant x2).
    expect(h.db.messages.filter((m) => m.role === 'user')).toHaveLength(2);
    expect(h.db.messages.filter((m) => m.role === 'assistant')).toHaveLength(2);
    // Citations were attached (grounded in the formula KB).
    expect(h.db.citations.length).toBeGreaterThan(0);
  });

  it('explains a published question grounded in the KB', async () => {
    const r = await h.explanation.explainQuestion('q-1');
    expect(r.content).toContain('B'); // correct choice
    expect(r.citations.some((c) => c.kind === 'question')).toBe(true);
    expect(r.groundedInKb).toBe(true);
  });

  it('gives a hint that never reveals the final answer', async () => {
    const r = await h.hints.hint('u-1', 'q-1', 3);
    expect(r.hint.toLowerCase()).toContain('nearly');
    expect(r.hint).not.toContain('Choice B');
  });

  it('produces a step-by-step solution ending in the correct choice', async () => {
    const r = await h.solution.solve('u-1', 'q-1');
    expect(r.steps.length).toBeGreaterThanOrEqual(3);
    expect(r.finalAnswer).toBe('Choice B');
    expect(r.citations.some((c) => c.kind === 'formula')).toBe(true);
  });

  it('formula assistant returns the matching formula + guidance', async () => {
    const r = await h.formulas.assist('ohm', { subjectId: 's-1' });
    expect(r.formulas[0]!.expression).toBe('V=IR');
    expect(r.guidance.length).toBeGreaterThan(0);
  });

  it('smart recommendations surface weak topics', async () => {
    // Seed a weak topic.
    h.db.mastery.push({ id: 'tm-x', userId: 'u-1', subjectId: 's-1', topicId: 't-1', attempts: 10, accuracy: 0.3, tier: 'novice' });
    const r = await h.recommendations.smartRecommendations('u-1', { limit: 5 });
    expect(r.focusTopics.length).toBeGreaterThan(0);
  });
});
