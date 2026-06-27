/**
 * @file question-workflow.integration.spec.ts
 * @module Questions/Tests/Integration
 *
 * Cross-service integration: the full question lifecycle wired through the Nest
 * DI container with mocked Prisma/Cache/Events but REAL QuestionService,
 * QuestionWorkflowService, QuestionSearchService and QuestionMapperService.
 *
 * Flow exercised: create (draft) → submit → approve ×4 stages → publish →
 * archive, asserting status + review-stage progression and emitted events at
 * each step.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { QuestionService } from '../../src/questions/services/question.service';
import { QuestionWorkflowService } from '../../src/questions/services/question-workflow.service';
import { QuestionMapperService } from '../../src/questions/services/question-mapper.service';

// ── In-memory-ish question state the mocked Prisma mutates ──────────────────────
let questionState: Record<string, unknown>;
let lastStageNote: string | null;

const choices = ['A', 'B', 'C', 'D'].map((letter, i) => ({
  choiceLetter: letter, choiceText: `Choice ${letter}`, choiceLatex: null, choiceHtml: null,
  isCorrect: letter === 'A', explanation: null, sortOrder: i,
}));

function freshQuestion() {
  return {
    id: 'q-1', questionCode: 'HYD-001', subjectId: 's-1', topicId: 't-1', subtopicId: 'st-1',
    difficultyLevelId: 'd-1', stemText: 'What is gravity?', stemLatex: null, stemHtml: null,
    correctChoice: 'A', explanationText: 'Gravity is 9.81 m/s²', explanationLatex: null, explanationHtml: null,
    questionStatus: 'draft', bloomLevel: 'apply', questionType: 'multiple_choice',
    learningObjective: null, prcSyllabusRef: null, estSolvingTimeSec: 90, language: 'en',
    authorId: 'author-1', reviewerId: null, publishedBy: null, currentVersion: 1,
    isPrcVerified: false, isAiGenerated: false, publishedAt: null,
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'),
    choices, questionTags: [],
  };
}

const tx = {
  question: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { questionState = { ...freshQuestion(), ...data, choices, questionTags: [] }; return questionState; }),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { questionState = { ...questionState, ...data }; return questionState; }),
  },
  questionChoice: { deleteMany: vi.fn(), createMany: vi.fn() },
  questionTag: { deleteMany: vi.fn(), createMany: vi.fn() },
  questionVersion: { create: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({}) },
  questionReviewWorkflow: {
    create: vi.fn(async ({ data }: { data: { notes?: string } }) => { if (data.notes?.includes('stage:')) lastStageNote = data.notes; return {}; }),
  },
};

const db = {
  question: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn(async () => questionState),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { questionState = { ...questionState, ...data }; return questionState; }),
  },
  subject: { findUnique: vi.fn().mockResolvedValue({ id: 's-1' }) },
  topic: { findUnique: vi.fn().mockResolvedValue({ id: 't-1' }) },
  subtopic: { findUnique: vi.fn().mockResolvedValue({ id: 'st-1' }) },
  difficultyLevel: { findUnique: vi.fn().mockResolvedValue({ id: 'd-1' }) },
  questionVersion: { updateMany: vi.fn().mockResolvedValue({}), findMany: vi.fn(), findUnique: vi.fn() },
  questionReviewWorkflow: {
    findFirst: vi.fn(async () => (lastStageNote ? { notes: lastStageNote } : null)),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
  },
  $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
};

const cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn(), invalidatePattern: vi.fn() };
const userRole = { hasPermission: vi.fn().mockResolvedValue(true) };
const emitted: string[] = [];

const author = { id: 'author-1', email: 'a@b.com', role: 'content_author', subscriptionTier: 'free' as const };
const reviewer = { id: 'rev-1', email: 'r@b.com', role: 'reviewer', subscriptionTier: 'free' as const };
const admin = { id: 'adm-1', email: 'adm@b.com', role: 'admin', subscriptionTier: 'pro' as const };

const createDto = {
  questionCode: 'HYD-001', subjectId: 's-1', topicId: 't-1', subtopicId: 'st-1', difficultyLevelId: 'd-1',
  stemText: 'What is gravity?', stemLatex: null, stemHtml: null,
  choices: ['A', 'B', 'C', 'D'].map((letter) => ({ letter, text: `Choice ${letter}`, latex: null, html: null, explanation: null })),
  correctChoice: 'A', explanationText: 'Gravity is 9.81 m/s²', explanationLatex: null, explanationHtml: null,
  bloomLevel: 'apply', questionType: 'multiple_choice', learningObjective: null, prcSyllabusRef: null,
  estSolvingTimeSec: 90, language: 'en', keywords: [], tags: [], isAiGenerated: false,
};

describe('Question lifecycle integration', () => {
  let questions: QuestionService;
  let workflow: QuestionWorkflowService;

  beforeAll(() => {
    // Wire the REAL services together directly with mocked infrastructure.
    // (Direct instantiation rather than Test.createTestingModule, because the
    // project's Vitest/esbuild transform does not emit the constructor-param
    // metadata Nest DI needs. This still exercises genuine cross-service
    // behaviour: the two real services share one mocked Prisma/state.)
    const mapper = new QuestionMapperService();
    const events = { emit: (e: string) => { emitted.push(e); return true; } };
    questions = new QuestionService(
      db as never, cache as never, userRole as never, mapper, events as never,
    );
    workflow = new QuestionWorkflowService(
      db as never, cache as never, userRole as never, events as never,
    );
  });

  beforeEach(() => {
    questionState = freshQuestion();
    lastStageNote = null;
    emitted.length = 0;
    cache.get.mockResolvedValue(null);
  });

  it('runs create → submit → 4-stage review → publish → archive', async () => {
    // Create
    const created = await questions.create(createDto as never, author);
    expect(created.status).toBe('draft');
    expect(emitted).toContain('question.created');

    // Submit for review → technical
    let r = await workflow.submitForReview('q-1', author);
    expect(r.status).toBe('in_review');
    expect(r.reviewStage).toBe('technical');

    // Approve technical → educational
    r = await workflow.approve('q-1', reviewer);
    expect(r.reviewStage).toBe('educational');

    // Approve educational → editorial
    r = await workflow.approve('q-1', reviewer);
    expect(r.reviewStage).toBe('editorial');

    // Approve editorial → qa
    r = await workflow.approve('q-1', reviewer);
    expect(r.reviewStage).toBe('qa');

    // Approve qa (final) → approved
    r = await workflow.approve('q-1', reviewer);
    expect(r.status).toBe('approved');
    expect(r.reviewStage).toBeNull();

    // Publish
    r = await workflow.publish('q-1', admin);
    expect(r.status).toBe('published');
    expect(emitted).toContain('question.published');

    // Archive
    r = await workflow.archive('q-1', admin);
    expect(r.status).toBe('archived');
    expect(emitted).toContain('question.archived');
  });

  it('rejection during review returns the question to draft', async () => {
    await questions.create(createDto as never, author);
    await workflow.submitForReview('q-1', author);
    const r = await workflow.reject('q-1', reviewer, 'Needs clearer units', false);
    expect(r.status).toBe('draft');
    expect(emitted).toContain('question.rejected');
  });

  it('blocks publishing a question that has not been approved', async () => {
    await questions.create(createDto as never, author);
    await workflow.submitForReview('q-1', author);
    // still in_review (technical) — not approved
    await expect(workflow.publish('q-1', admin)).rejects.toMatchObject({
      response: { code: 'NOT_PUBLISHABLE' },
    });
  });
});
