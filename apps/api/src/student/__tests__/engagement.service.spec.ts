import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EngagementService } from '../services/engagement.service';

function mocks() {
  const prisma = {
    question: { findFirst: vi.fn().mockResolvedValue({ questionStatus: 'published' }) },
    bookmark: { findUnique: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'bm-1' }), delete: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
    favorite: { findUnique: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'fav-1' }), delete: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
    recentlyViewed: { upsert: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({}) },
    questionAttempt: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma, svc: new EngagementService(prisma as never) };
}

describe('EngagementService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('bookmarks', () => {
    it('adds a bookmark for a published question', async () => {
      m.prisma.bookmark.findUnique.mockResolvedValue(null);
      const bm = await m.svc.addBookmark('u-1', { questionId: 'q-1' } as never);
      expect(bm.id).toBe('bm-1');
    });
    it('rejects a duplicate bookmark', async () => {
      m.prisma.bookmark.findUnique.mockResolvedValue({ id: 'bm-1' });
      await expect(m.svc.addBookmark('u-1', { questionId: 'q-1' } as never)).rejects.toThrow(ConflictException);
    });
    it('rejects bookmarking an unpublished question', async () => {
      m.prisma.question.findFirst.mockResolvedValue({ questionStatus: 'draft' });
      await expect(m.svc.addBookmark('u-1', { questionId: 'q-1' } as never)).rejects.toThrow(BadRequestException);
    });
    it('removes an existing bookmark', async () => {
      m.prisma.bookmark.findUnique.mockResolvedValue({ id: 'bm-1' });
      const result = await m.svc.removeBookmark('u-1', 'q-1');
      expect(result.deleted).toBe(true);
    });
    it('throws when removing a non-existent bookmark', async () => {
      m.prisma.bookmark.findUnique.mockResolvedValue(null);
      await expect(m.svc.removeBookmark('u-1', 'q-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('favorites', () => {
    it('adds and rejects duplicate favorites', async () => {
      m.prisma.favorite.findUnique.mockResolvedValue(null);
      await m.svc.addFavorite('u-1', 'q-1');
      m.prisma.favorite.findUnique.mockResolvedValue({ id: 'fav-1' });
      await expect(m.svc.addFavorite('u-1', 'q-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('recordView', () => {
    it('upserts a view and trims beyond the cap', async () => {
      m.prisma.recentlyViewed.findMany.mockResolvedValue(Array.from({ length: 55 }, (_, i) => ({ id: `rv-${i}` })));
      await m.svc.recordView('u-1', 'q-1');
      expect(m.prisma.recentlyViewed.upsert).toHaveBeenCalled();
      expect(m.prisma.recentlyViewed.deleteMany).toHaveBeenCalled();
    });
    it('does not trim under the cap', async () => {
      m.prisma.recentlyViewed.findMany.mockResolvedValue([{ id: 'rv-1' }]);
      await m.svc.recordView('u-1', 'q-1');
      expect(m.prisma.recentlyViewed.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('returns paginated attempt history with filters', async () => {
      m.prisma.questionAttempt.findMany.mockResolvedValue([{ id: 'a-1', questionId: 'q-1', outcome: 'correct', isCorrect: true, selectedChoice: 'B', timeSpentSec: 20, attemptedAt: new Date() }]);
      const result = await m.svc.questionHistory('u-1', { limit: 20, outcome: 'correct' } as never);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(false);
    });
  });
});
