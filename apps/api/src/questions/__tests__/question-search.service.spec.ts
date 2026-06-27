/**
 * @file question-search.service.spec.ts
 * @module Questions/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { QuestionSearchService } from '../services/question-search.service';
import { QuestionMapperService } from '../services/question-mapper.service';

const author = { id: 'author-1', email: 'a@b.com', role: 'content_author', subscriptionTier: 'free' as const };
const superAdmin = { id: 'sa-1', email: 'sa@b.com', role: 'super_admin', subscriptionTier: 'pro' as const };

const row = (over: Record<string, unknown> = {}) => ({
  id: 'q-1', questionCode: 'HYD-001', subjectId: 's-1', topicId: 't-1', subtopicId: 'st-1',
  difficultyLevelId: 'd-1', stemText: 'stem', stemLatex: null, stemHtml: null, correctChoice: 'A',
  explanationText: 'exp', explanationLatex: null, explanationHtml: null, questionStatus: 'published',
  bloomLevel: 'apply', questionType: 'multiple_choice', learningObjective: null, prcSyllabusRef: null,
  estSolvingTimeSec: 90, language: 'en', authorId: 'author-1', reviewerId: null, publishedBy: null,
  currentVersion: 1, isPrcVerified: false, isAiGenerated: false, publishedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'),
  choices: [], questionTags: [], ...over,
});

const mockPrisma = {
  question: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  questionVersion: { findMany: vi.fn(), findUnique: vi.fn() },
};
const mockCache = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
const mockQuestionService = { create: vi.fn() };
const mockUserRole = { hasPermission: vi.fn().mockResolvedValue(false) };

const build = () => new QuestionSearchService(
  mockPrisma as never, mockCache as never, mockQuestionService as never,
  new QuestionMapperService(), mockUserRole as never,
);

describe('QuestionSearchService', () => {
  let service: QuestionSearchService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = build();
    mockCache.get.mockResolvedValue(null);
  });

  describe('search()', () => {
    it('returns a cursor page with hasMore=false when under the limit', async () => {
      mockPrisma.question.findMany.mockResolvedValue([row()]);
      mockPrisma.question.count.mockResolvedValue(1);
      const result = await service.search({ limit: 20 } as never, author);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.cursor).toBeNull();
    });

    it('sets hasMore and a cursor when results exceed the limit', async () => {
      const rows = Array.from({ length: 3 }, (_, i) => row({ id: `q-${i}` }));
      mockPrisma.question.findMany.mockResolvedValue(rows);
      mockPrisma.question.count.mockResolvedValue(10);
      const result = await service.search({ limit: 2 } as never, author);
      expect(result.data).toHaveLength(2);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.cursor).toBe('q-1');
    });

    it('restricts non-privileged callers to published by default', async () => {
      mockPrisma.question.findMany.mockResolvedValue([]);
      mockPrisma.question.count.mockResolvedValue(0);
      await service.search({ limit: 20 } as never, author);
      const whereArg = mockPrisma.question.findMany.mock.calls[0]![0].where;
      expect(whereArg.questionStatus).toBe('published');
    });

    it('does not force published for super_admin', async () => {
      mockPrisma.question.findMany.mockResolvedValue([]);
      mockPrisma.question.count.mockResolvedValue(0);
      await service.search({ limit: 20 } as never, superAdmin);
      const whereArg = mockPrisma.question.findMany.mock.calls[0]![0].where;
      expect(whereArg.questionStatus).toBeUndefined();
    });

    it('serves from cache when present', async () => {
      mockCache.get.mockResolvedValue({ data: [], pagination: { cursor: null, hasMore: false, total: 0 } });
      const result = await service.search({ limit: 20 } as never, author);
      expect(result.pagination.total).toBe(0);
      expect(mockPrisma.question.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getVersions()', () => {
    it('lists versions for the owner', async () => {
      mockPrisma.question.findFirst.mockResolvedValue({ id: 'q-1', authorId: 'author-1', questionStatus: 'draft' });
      mockPrisma.questionVersion.findMany.mockResolvedValue([
        { id: 'v2', versionNumber: 2, changeType: 'edit', changeSummary: 's', changedBy: 'author-1', reviewedBy: null, isCurrent: true, createdAt: new Date() },
        { id: 'v1', versionNumber: 1, changeType: 'create', changeSummary: 'init', changedBy: 'author-1', reviewedBy: null, isCurrent: false, createdAt: new Date() },
      ]);
      const versions = await service.getVersions('q-1', author);
      expect(versions).toHaveLength(2);
      expect(versions[0]!.versionNumber).toBe(2);
    });

    it('forbids a stranger from viewing draft versions', async () => {
      mockPrisma.question.findFirst.mockResolvedValue({ id: 'q-1', authorId: 'author-1', questionStatus: 'draft' });
      mockUserRole.hasPermission.mockResolvedValue(false);
      const stranger = { ...author, id: 'stranger' };
      await expect(service.getVersions('q-1', stranger)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound for a missing question', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(null);
      await expect(service.getVersions('ghost', author)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVersionSnapshot()', () => {
    it('returns the stored snapshot', async () => {
      mockPrisma.questionVersion.findUnique.mockResolvedValue({ contentSnapshot: { stemText: 'snap' } });
      const snap = await service.getVersionSnapshot('q-1', 1);
      expect(snap).toEqual({ stemText: 'snap' });
    });

    it('throws when the version is missing', async () => {
      mockPrisma.questionVersion.findUnique.mockResolvedValue(null);
      await expect(service.getVersionSnapshot('q-1', 99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkImport()', () => {
    const payload = (n: number) => ({
      questions: Array.from({ length: n }, (_, i) => ({ questionCode: `Q-${i}` })),
      atomic: true,
    });

    it('imports all rows atomically', async () => {
      mockQuestionService.create.mockResolvedValue({ id: 'new-id' });
      const result = await service.bulkImport(payload(3) as never, author);
      expect(result.imported).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockQuestionService.create).toHaveBeenCalledTimes(3);
    });

    it('rolls back the whole atomic batch on any failure', async () => {
      mockQuestionService.create
        .mockResolvedValueOnce({ id: 'id-0' })
        .mockRejectedValueOnce(Object.assign(new Error('dup'), { response: { code: 'QUESTION_CODE_TAKEN', message: 'dup' } }));
      mockPrisma.question.updateMany.mockResolvedValue({});
      const err = await service.bulkImport(payload(3) as never, author).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      // The one created row is soft-deleted (rollback)
      expect(mockPrisma.question.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });

    it('non-atomic import collects per-row errors and keeps valid rows', async () => {
      mockQuestionService.create
        .mockResolvedValueOnce({ id: 'id-0' })
        .mockRejectedValueOnce(Object.assign(new Error('bad'), { response: { code: 'CHOICES_INVALID', message: 'bad choices' } }))
        .mockResolvedValueOnce({ id: 'id-2' });
      const result = await service.bulkImport({ ...payload(3), atomic: false } as never, author);
      expect(result.imported).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toMatchObject({ index: 1, code: 'CHOICES_INVALID' });
    });
  });

  describe('bulkExport()', () => {
    it('exports filtered questions with a count', async () => {
      mockPrisma.question.findMany.mockResolvedValue([row(), row({ id: 'q-2' })]);
      const result = await service.bulkExport({ limit: 1000, status: 'published' } as never, superAdmin);
      expect(result.count).toBe(2);
      expect(result.questions).toHaveLength(2);
    });
  });
});
