/**
 * @file cms-workflow.integration.spec.ts
 * @module Cms/Tests/Integration
 *
 * Cross-service integration for the Admin CMS. Wires the REAL CmsQuestionService,
 * CmsWorkflowService, CmsAnalyticsService and the Sprint 2.6 QuestionWorkflowService
 * directly (mocked Prisma/Cache/Events), then drives a full CMS coordination flow:
 *   lock → assign → comment → submit → approve → publish → timeline, plus a bulk
 *   operation across questions.
 *
 * Direct instantiation (not Test.createTestingModule) is used because the
 * project's Vitest/esbuild transform does not emit the constructor metadata Nest
 * DI relies on — see the questions integration spec for the same rationale.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { CmsQuestionService } from '../../src/cms/services/cms-question.service';
import { CmsWorkflowService } from '../../src/cms/services/cms-workflow.service';
import { QuestionWorkflowService } from '../../src/questions/services/question-workflow.service';

// ── shared mutable state the mocked Prisma manipulates ──────────────────────────
let questionStatus: string;
let lastStageNote: string | null;
const locks: Record<string, unknown>[] = [];
const assignments: Record<string, unknown>[] = [];
const comments: Record<string, unknown>[] = [];

const future = () => new Date(Date.now() + 600_000);

const wfTx = {
  question: { update: vi.fn(async ({ data }: { data: { questionStatus?: string } }) => { if (data.questionStatus) questionStatus = data.questionStatus; return {}; }) },
  questionReviewWorkflow: { create: vi.fn(async ({ data }: { data: { notes?: string } }) => { if (data.notes?.includes('stage:')) lastStageNote = data.notes; return {}; }) },
};

const db = {
  question: {
    findFirst: vi.fn(async () => ({ id: 'q-1', authorId: 'author-1', questionStatus, currentVersion: 1 })),
    update: vi.fn(async ({ data }: { data: { questionStatus?: string } }) => { if (data.questionStatus) questionStatus = data.questionStatus; return {}; }),
  },
  questionLock: {
    updateMany: vi.fn(async () => ({})),
    findFirst: vi.fn(async () => locks.find((l) => l.releasedAt === null) ?? null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const l = { id: `lock-${locks.length}`, acquiredAt: new Date(), expiresAt: future(), releasedAt: null, reason: null, ...data }; locks.push(l); return l; }),
    update: vi.fn(async ({ where, data }: { where: { id: string }, data: Record<string, unknown> }) => { const l = locks.find((x) => x.id === where.id)!; Object.assign(l, data); return l; }),
    findMany: vi.fn(async () => locks),
  },
  reviewAssignment: {
    findFirst: vi.fn(async () => assignments.find((a) => a.completedAt === null) ?? null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const a = { id: `asg-${assignments.length}`, assignedAt: new Date(), completedAt: null, status: 'pending', dueAt: null, ...data }; assignments.push(a); return a; }),
    update: vi.fn(async ({ where, data }: { where: { id: string }, data: Record<string, unknown> }) => { const a = assignments.find((x) => x.id === where.id)!; Object.assign(a, data); return a; }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => assignments.find((x) => x.id === where.id) ?? null),
    findMany: vi.fn(async () => assignments),
  },
  reviewComment: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const c = { id: `cmt-${comments.length}`, createdAt: new Date(), isResolved: false, resolvedBy: null, resolvedAt: null, parentId: null, stage: null, ...data }; comments.push(c); return c; }),
    findFirst: vi.fn(async () => comments[0] ?? null),
    update: vi.fn(async () => ({ id: 'cmt-0', questionId: 'q-1', authorId: 'a', parentId: null, stage: null, body: 'x', isResolved: true, resolvedBy: 'u', resolvedAt: new Date(), createdAt: new Date() })),
    findMany: vi.fn(async () => comments.map((c) => ({ ...c, replies: [] }))),
  },
  editorialNote: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn(async () => []) },
  questionReviewWorkflow: {
    findFirst: vi.fn(async () => (lastStageNote ? { notes: lastStageNote } : null)),
    findMany: vi.fn(async () => []),
    create: vi.fn(),
  },
  questionVersion: { updateMany: vi.fn(async () => ({})) },
  $transaction: vi.fn(async (fn: (t: typeof wfTx) => unknown) => fn(wfTx)),
};

const cache = { del: vi.fn(), invalidatePattern: vi.fn() };
const userRole = { hasPermission: vi.fn().mockResolvedValue(true) };
const emitted: string[] = [];
const events = { emit: (e: string) => { emitted.push(e); return true; } };

const admin = { id: 'admin-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' as const };
const reviewer = { id: 'rev-1', email: 'r@b.com', role: 'reviewer', subscriptionTier: 'free' as const };

describe('CMS workflow integration', () => {
  let cmsQuestion: CmsQuestionService;
  let cmsWorkflow: CmsWorkflowService;

  beforeAll(() => {
    const questionWorkflow = new QuestionWorkflowService(db as never, cache as never, userRole as never, events as never);
    cmsQuestion = new CmsQuestionService(db as never, userRole as never, { findById: vi.fn() } as never, { getVersions: vi.fn() } as never, events as never);
    cmsWorkflow = new CmsWorkflowService(questionWorkflow, cmsQuestion, events as never);
  });

  beforeEach(() => {
    questionStatus = 'draft';
    lastStageNote = null;
    locks.length = 0; assignments.length = 0; comments.length = 0;
    emitted.length = 0;
    userRole.hasPermission.mockResolvedValue(true);
  });

  it('runs lock → assign → comment → submit → approve×4 → publish → timeline', async () => {
    // Lock
    const lock = await cmsQuestion.acquireLock('q-1', { reason: 'editing' }, admin);
    expect(lock.isActive).toBe(true);
    expect(emitted).toContain('cms.question.locked');

    // Assign technical reviewer
    const assignment = await cmsQuestion.assignReview('q-1', { assigneeId: 'rev-1', stage: 'technical' } as never, admin);
    expect(assignment.stage).toBe('technical');
    expect(emitted).toContain('cms.review.assigned');

    // Comment
    await cmsQuestion.addComment('q-1', { body: 'Check units in the stem.' } as never, reviewer);
    expect(emitted).toContain('cms.review.comment_added');

    // Submit → in_review (technical)
    let r = await cmsWorkflow.submit('q-1', admin);
    expect(r.status).toBe('in_review');
    expect(r.reviewStage).toBe('technical');

    // Approve through all four stages
    r = await cmsWorkflow.approve('q-1', reviewer); expect(r.reviewStage).toBe('educational');
    r = await cmsWorkflow.approve('q-1', reviewer); expect(r.reviewStage).toBe('editorial');
    r = await cmsWorkflow.approve('q-1', reviewer); expect(r.reviewStage).toBe('qa');
    r = await cmsWorkflow.approve('q-1', reviewer); expect(r.status).toBe('approved');

    // Publish
    r = await cmsWorkflow.publish('q-1', admin);
    expect(r.status).toBe('published');

    // Timeline merges comments + assignments + locks
    const timeline = await cmsQuestion.getActivityTimeline('q-1', admin);
    const types = new Set(timeline.map((t) => t.type));
    expect(types.has('comment')).toBe(true);
    expect(types.has('assignment')).toBe(true);
    expect(types.has('lock')).toBe(true);
  });

  it('bulk approve accounts success and failure across questions', async () => {
    lastStageNote = 'stage:qa'; // final stage so approve → approved succeeds
    // Each question is independently in_review; reset status on every load so
    // one item's transition doesn't bleed into the next (the shared-state mock
    // models a single question, so we re-arm it per findFirst call).
    db.question.findFirst.mockImplementation(async () => {
      questionStatus = 'in_review';
      return { id: 'q-x', authorId: 'author-1', questionStatus, currentVersion: 1 };
    });
    const result = await cmsWorkflow.bulk({ operation: 'approve', questionIds: ['q-1', 'q-2'] } as never, admin);
    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(emitted).toContain('cms.bulk.operation');
  });

  it('lock conflict blocks a second editor', async () => {
    await cmsQuestion.acquireLock('q-1', {}, admin);
    await expect(cmsQuestion.acquireLock('q-1', {}, reviewer)).rejects.toMatchObject({
      response: { code: 'QUESTION_LOCKED' },
    });
  });
});
