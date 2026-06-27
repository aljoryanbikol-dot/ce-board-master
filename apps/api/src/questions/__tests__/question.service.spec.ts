/**
 * @file question.service.spec.ts
 * @module Questions/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuestionService } from '../services/question.service';
import { QuestionMapperService } from '../services/question-mapper.service';

const choices = ['A', 'B', 'C', 'D'].map((letter, i) => ({
  choiceLetter: letter, choiceText: `Choice ${letter}`, choiceLatex: null, choiceHtml: null,
  isCorrect: letter === 'A', explanation: null, sortOrder: i,
}));

const dbQuestion = {
  id: 'q-1', questionCode: 'HYD-001', subjectId: 's-1', topicId: 't-1', subtopicId: 'st-1',
  difficultyLevelId: 'd-1', stemText: 'What is g?', stemLatex: null, stemHtml: null,
  correctChoice: 'A', explanationText: 'Gravity is 9.81', explanationLatex: null, explanationHtml: null,
  questionStatus: 'draft', bloomLevel: 'apply', questionType: 'multiple_choice',
  learningObjective: null, prcSyllabusRef: null, estSolvingTimeSec: 90, language: 'en',
  authorId: 'author-1', reviewerId: null, publishedBy: null, currentVersion: 1,
  isPrcVerified: false, isAiGenerated: false, publishedAt: null,
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'),
  choices, questionTags: [],
};

const validCreate = {
  questionCode: 'HYD-001', subjectId: 's-1', topicId: 't-1', subtopicId: 'st-1', difficultyLevelId: 'd-1',
  stemText: 'What is gravity?', stemLatex: null, stemHtml: null,
  choices: ['A', 'B', 'C', 'D'].map((letter) => ({ letter, text: `Choice ${letter}`, latex: null, html: null, explanation: null })),
  correctChoice: 'A', explanationText: 'Gravity is 9.81 m/s²', explanationLatex: null, explanationHtml: null,
  bloomLevel: 'apply', questionType: 'multiple_choice', learningObjective: null, prcSyllabusRef: null,
  estSolvingTimeSec: 90, language: 'en', keywords: [], tags: [], isAiGenerated: false,
};

const author = { id: 'author-1', email: 'a@b.com', role: 'content_author', subscriptionTier: 'free' as const };
const other  = { id: 'other-1', email: 'o@b.com', role: 'content_author', subscriptionTier: 'free' as const };
const superAdmin = { id: 'sa-1', email: 'sa@b.com', role: 'super_admin', subscriptionTier: 'pro' as const };

const tx = {
  question: { create: vi.fn(), update: vi.fn() },
  questionChoice: { deleteMany: vi.fn(), createMany: vi.fn() },
  questionTag: { deleteMany: vi.fn(), createMany: vi.fn() },
  questionVersion: { create: vi.fn(), updateMany: vi.fn() },
};
const mockPrisma = {
  question: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  subject: { findUnique: vi.fn().mockResolvedValue({ id: 's-1' }) },
  topic: { findUnique: vi.fn().mockResolvedValue({ id: 't-1' }) },
  subtopic: { findUnique: vi.fn().mockResolvedValue({ id: 'st-1' }) },
  difficultyLevel: { findUnique: vi.fn().mockResolvedValue({ id: 'd-1' }) },
  questionReviewWorkflow: { findFirst: vi.fn().mockResolvedValue(null) },
  $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
};
const mockCache = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn(), invalidatePattern: vi.fn() };
const mockUserRole = { hasPermission: vi.fn().mockResolvedValue(false) };
const mockEvents = { emit: vi.fn() };

const build = () => new QuestionService(
  mockPrisma as never, mockCache as never, mockUserRole as never,
  new QuestionMapperService(), mockEvents as never,
);

describe('QuestionService', () => {
  let service: QuestionService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = build();
    mockCache.get.mockResolvedValue(null);
    mockPrisma.question.findUnique.mockResolvedValue(null); // code available
    mockPrisma.subject.findUnique.mockResolvedValue({ id: 's-1' });
    mockPrisma.topic.findUnique.mockResolvedValue({ id: 't-1' });
    mockPrisma.subtopic.findUnique.mockResolvedValue({ id: 'st-1' });
    mockPrisma.difficultyLevel.findUnique.mockResolvedValue({ id: 'd-1' });
    tx.question.create.mockResolvedValue(dbQuestion);
    tx.questionVersion.create.mockResolvedValue({});
  });

  describe('create()', () => {
    it('creates a draft with an initial version snapshot', async () => {
      const result = await service.create(validCreate as never, author);
      expect(result.id).toBe('q-1');
      expect(result.status).toBe('draft');
      expect(tx.questionVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ versionNumber: 1, isCurrent: true }) }));
      expect(mockEvents.emit).toHaveBeenCalledWith('question.created', expect.anything());
    });

    it('rejects a duplicate question code', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create(validCreate as never, author)).rejects.toThrow(ConflictException);
    });

    it('rejects when taxonomy is missing', async () => {
      mockPrisma.subtopic.findUnique.mockResolvedValue(null);
      await expect(service.create(validCreate as never, author)).rejects.toThrow();
    });

    it('rejects when correctChoice is not among choices', async () => {
      const bad = { ...validCreate, correctChoice: 'Z' };
      await expect(service.create(bad as never, author)).rejects.toThrow();
    });
  });

  describe('findById()', () => {
    it('returns a draft to its owner', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(dbQuestion);
      const result = await service.findById('q-1', author);
      expect(result.id).toBe('q-1');
    });

    it('forbids a non-owner from reading another author draft', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(dbQuestion);
      mockUserRole.hasPermission.mockResolvedValue(false);
      await expect(service.findById('q-1', other)).rejects.toThrow(ForbiddenException);
    });

    it('allows a reviewer to read a draft', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(dbQuestion);
      mockUserRole.hasPermission.mockResolvedValue(true);
      const result = await service.findById('q-1', other);
      expect(result.id).toBe('q-1');
    });

    it('lets anyone read a published question', async () => {
      mockPrisma.question.findFirst.mockResolvedValue({ ...dbQuestion, questionStatus: 'published' });
      const result = await service.findById('q-1', other);
      expect(result.status).toBe('published');
    });

    it('throws NotFound for a missing question', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(null);
      await expect(service.findById('ghost', author)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    beforeEach(() => {
      mockPrisma.question.findFirst.mockResolvedValue(dbQuestion);
      tx.question.update.mockResolvedValue({ ...dbQuestion, currentVersion: 2 });
    });

    it('increments version and writes a new snapshot', async () => {
      const result = await service.update('q-1', { stemText: 'Updated stem text here' } as never, author);
      expect(result.currentVersion).toBe(2);
      expect(tx.questionVersion.create).toHaveBeenCalled();
    });

    it('throws VERSION_CONFLICT on stale version', async () => {
      const err = await service.update('q-1', { stemText: 'x'.repeat(11), version: 99 } as never, author).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('VERSION_CONFLICT');
    });

    it('forbids a non-owner without manage permission', async () => {
      mockUserRole.hasPermission.mockResolvedValue(false);
      await expect(service.update('q-1', { stemText: 'x'.repeat(11) } as never, other)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('softDelete()', () => {
    it('soft-deletes a draft', async () => {
      mockPrisma.question.findFirst.mockResolvedValue({ id: 'q-1', authorId: 'author-1', questionStatus: 'draft' });
      mockPrisma.question.update.mockResolvedValue({});
      await service.softDelete('q-1', author);
      expect(mockPrisma.question.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }));
    });

    it('refuses to delete a published question', async () => {
      mockPrisma.question.findFirst.mockResolvedValue({ id: 'q-1', authorId: 'author-1', questionStatus: 'published' });
      const err = await service.softDelete('q-1', author).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.getResponse().code).toBe('CANNOT_DELETE_PUBLISHED');
    });
  });

  describe('clone()', () => {
    it('clones into a new draft owned by the caller with a derived code', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(dbQuestion);
      mockPrisma.question.findUnique.mockResolvedValue(null); // clone code available
      tx.question.create.mockResolvedValue({ ...dbQuestion, id: 'q-2', questionCode: 'HYD-001-COPY', authorId: 'sa-1' });
      const result = await service.clone('q-1', superAdmin);
      expect(result.id).toBe('q-2');
      expect(mockEvents.emit).toHaveBeenCalledWith('question.cloned', expect.anything());
    });
  });
});
