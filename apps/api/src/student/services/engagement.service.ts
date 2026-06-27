/**
 * @file engagement.service.ts
 * @module Student/Services
 *
 * EngagementService — bookmarks, favorites, recently-viewed, and answered/viewed
 * history. All ownership-scoped: every query is filtered by userId and mutations
 * verify ownership. Recently-viewed is a capped ring (newest wins).
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StudentErrors } from '../errors/student.errors';
import { PRACTICE_LIMITS } from '../constants/student.constants';
import type { CreateBookmarkDto, HistoryQueryDto } from '../dto/student.dto';

@Injectable()
export class EngagementService {

  constructor(private readonly prisma: PrismaService) {}

  // ── Bookmarks ───────────────────────────────────────────────────────────────
  async addBookmark(userId: string, dto: CreateBookmarkDto) {
    await this.assertPublishedQuestion(dto.questionId);
    const existing = await this.prisma.bookmark.findUnique({ where: { userId_questionId: { userId, questionId: dto.questionId } } });
    if (existing) throw StudentErrors.alreadyBookmarked();
    return this.prisma.bookmark.create({ data: { userId, questionId: dto.questionId, note: dto.note ?? null } });
  }

  async removeBookmark(userId: string, questionId: string) {
    const existing = await this.prisma.bookmark.findUnique({ where: { userId_questionId: { userId, questionId } } });
    if (!existing) throw StudentErrors.bookmarkNotFound();
    await this.prisma.bookmark.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  async listBookmarks(userId: string, limit: number, cursor?: string) {
    return this.paginate('bookmark', userId, limit, cursor, { createdAt: 'desc' });
  }

  // ── Favorites ───────────────────────────────────────────────────────────────
  async addFavorite(userId: string, questionId: string) {
    await this.assertPublishedQuestion(questionId);
    const existing = await this.prisma.favorite.findUnique({ where: { userId_questionId: { userId, questionId } } });
    if (existing) throw StudentErrors.alreadyFavorited();
    return this.prisma.favorite.create({ data: { userId, questionId } });
  }

  async removeFavorite(userId: string, questionId: string) {
    const existing = await this.prisma.favorite.findUnique({ where: { userId_questionId: { userId, questionId } } });
    if (!existing) throw StudentErrors.favoriteNotFound();
    await this.prisma.favorite.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  async listFavorites(userId: string, limit: number, cursor?: string) {
    return this.paginate('favorite', userId, limit, cursor, { createdAt: 'desc' });
  }

  // ── Recently viewed (capped ring) ──────────────────────────────────────────────
  async recordView(userId: string, questionId: string) {
    await this.prisma.recentlyViewed.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: { userId, questionId },
      update: { viewedAt: new Date() },
    });
    // Trim beyond the cap.
    const all = await this.prisma.recentlyViewed.findMany({ where: { userId }, orderBy: { viewedAt: 'desc' }, select: { id: true } });
    if (all.length > PRACTICE_LIMITS.RECENTLY_VIEWED_CAP) {
      const stale = all.slice(PRACTICE_LIMITS.RECENTLY_VIEWED_CAP).map((r: { id: string }) => r.id);
      await this.prisma.recentlyViewed.deleteMany({ where: { id: { in: stale } } });
    }
    return { recorded: true };
  }

  async listRecentlyViewed(userId: string, limit: number) {
    const rows = await this.prisma.recentlyViewed.findMany({ where: { userId }, orderBy: { viewedAt: 'desc' }, take: Math.min(limit, PRACTICE_LIMITS.RECENTLY_VIEWED_CAP) });
    return rows.map((r: { questionId: string; viewedAt: Date }) => ({ questionId: r.questionId, viewedAt: r.viewedAt.toISOString() }));
  }

  // ── History ───────────────────────────────────────────────────────────────────
  async questionHistory(userId: string, dto: HistoryQueryDto) {
    const where: Prisma.QuestionAttemptWhereInput = {
      userId,
      ...(dto.subjectId && { subjectId: dto.subjectId }),
      ...(dto.topicId && { topicId: dto.topicId }),
      ...(dto.outcome && { outcome: dto.outcome as never }),
      ...(dto.cursor && { id: { lt: dto.cursor } }),
    };
    const rows = await this.prisma.questionAttempt.findMany({ where, orderBy: { attemptedAt: 'desc' }, take: dto.limit + 1 });
    const hasMore = rows.length > dto.limit;
    const page = hasMore ? rows.slice(0, dto.limit) : rows;
    return {
      data: page.map((a: { id: string; questionId: string; outcome: string; isCorrect: boolean; selectedChoice: string | null; timeSpentSec: number; attemptedAt: Date }) => ({
        id: a.id, questionId: a.questionId, outcome: a.outcome, isCorrect: a.isCorrect, selectedChoice: a.selectedChoice, timeSpentSec: a.timeSpentSec, attemptedAt: a.attemptedAt.toISOString(),
      })),
      pagination: { cursor: hasMore ? page[page.length - 1]!.id : null, hasMore },
    };
  }

  async recentlyAnswered(userId: string, limit: number) {
    const rows = await this.prisma.questionAttempt.findMany({ where: { userId }, orderBy: { attemptedAt: 'desc' }, take: limit, distinct: ['questionId'] });
    return rows.map((a: { questionId: string; outcome: string; isCorrect: boolean; attemptedAt: Date }) => ({ questionId: a.questionId, outcome: a.outcome, isCorrect: a.isCorrect, attemptedAt: a.attemptedAt.toISOString() }));
  }

  // ── helpers ───────────────────────────────────────────────────────────────────
  private async assertPublishedQuestion(questionId: string) {
    const q = await this.prisma.question.findFirst({ where: { id: questionId, deletedAt: null }, select: { questionStatus: true } });
    if (!q) throw StudentErrors.questionNotFound(questionId);
    if (q.questionStatus !== 'published') throw StudentErrors.questionNotAvailable(questionId);
  }

  private async paginate(model: 'bookmark' | 'favorite', userId: string, limit: number, cursor: string | undefined, orderBy: Record<string, 'asc' | 'desc'>) {
    const delegate = (model === 'bookmark' ? this.prisma.bookmark : this.prisma.favorite) as unknown as { findMany: (args: unknown) => Promise<{ id: string; questionId: string; createdAt: Date }[]> };
    const rows = await delegate.findMany({ where: { userId }, orderBy, take: limit + 1, ...(cursor && { cursor: { id: cursor }, skip: 1 }) });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return { data: page.map((r) => ({ id: r.id, questionId: r.questionId, createdAt: r.createdAt.toISOString() })), pagination: { cursor: hasMore ? page[page.length - 1]!.id : null, hasMore } };
  }
}
