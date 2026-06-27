/**
 * @file cms-analytics.service.ts
 * @module Cms/Services
 *
 * CmsAnalyticsService — read-only aggregation engine for the Admin CMS.
 * Produces queue counts, per-dimension statistics (subject/topic/author/
 * reviewer), the review queue, recent activity, and advanced CMS search.
 *
 * All queries are filtered to non-deleted questions. Results that are
 * expensive and globally shared (the dashboard overview) are cached briefly;
 * per-question or per-filter reads are not cached to stay fresh for editors.
 */
import { Injectable } from '@nestjs/common';
import { QuestionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService, CacheNamespace, CacheTTL } from '../../cache/cache.service';
import {
  DASHBOARD_CACHE_KEY, DASHBOARD_RECENT_LIMIT, REVIEW_QUEUE_LIMIT,
} from '../constants/cms.constants';
import type { CmsSearchDto } from '../dto/cms-search.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

interface StatusCounts {
  total: number; draft: number; inReview: number; approved: number; published: number; archived: number; flagged: number;
}

@Injectable()
export class CmsAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Status counts ─────────────────────────────────────────────────────────────

  async getStatusCounts(): Promise<StatusCounts> {
    const grouped = await this.prisma.question.groupBy({
      by: ['questionStatus'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const by = (s: QuestionStatus): number =>
      grouped.find((g: (typeof grouped)[number]) => g.questionStatus === s)?._count._all ?? 0;
    const draft = by(QuestionStatus.draft);
    const inReview = by(QuestionStatus.in_review);
    const approved = by(QuestionStatus.approved);
    const published = by(QuestionStatus.published);
    const archived = by(QuestionStatus.archived);
    const flagged = by(QuestionStatus.flagged);
    return { total: draft + inReview + approved + published + archived + flagged, draft, inReview, approved, published, archived, flagged };
  }

  // ── Per-dimension statistics ───────────────────────────────────────────────────

  async getSubjectStatistics() {
    const grouped = await this.prisma.question.groupBy({
      by: ['subjectId', 'questionStatus'], where: { deletedAt: null }, _count: { _all: true },
    });
    return this.rollup(grouped, 'subjectId');
  }

  async getTopicStatistics() {
    const grouped = await this.prisma.question.groupBy({
      by: ['topicId', 'questionStatus'], where: { deletedAt: null }, _count: { _all: true },
    });
    return this.rollup(grouped, 'topicId');
  }

  async getAuthorStatistics() {
    const grouped = await this.prisma.question.groupBy({
      by: ['authorId', 'questionStatus'], where: { deletedAt: null }, _count: { _all: true },
    });
    return this.rollup(grouped, 'authorId');
  }

  async getReviewerStatistics() {
    const grouped = await this.prisma.question.groupBy({
      by: ['reviewerId', 'questionStatus'],
      where: { deletedAt: null, reviewerId: { not: null } }, _count: { _all: true },
    });
    return this.rollup(grouped, 'reviewerId');
  }

  // ── Review queue ────────────────────────────────────────────────────────────

  async getReviewQueue(limit = REVIEW_QUEUE_LIMIT) {
    const rows = await this.prisma.question.findMany({
      where: { deletedAt: null, questionStatus: QuestionStatus.in_review },
      orderBy: { updatedAt: 'asc' }, // oldest waiting first
      take: limit,
      select: {
        id: true, questionCode: true, subjectId: true, topicId: true,
        authorId: true, reviewerId: true, currentVersion: true, updatedAt: true,
      },
    });
    return rows.map((r: (typeof rows)[number]) => ({
      id: r.id, questionCode: r.questionCode, subjectId: r.subjectId, topicId: r.topicId,
      authorId: r.authorId, reviewerId: r.reviewerId, version: r.currentVersion, waitingSince: r.updatedAt.toISOString(),
    }));
  }

  // ── Recent activity ───────────────────────────────────────────────────────────

  async getRecentActivity(limit = DASHBOARD_RECENT_LIMIT) {
    const rows = await this.prisma.questionReviewWorkflow.findMany({
      orderBy: { occurredAt: 'desc' }, take: limit,
      select: { id: true, questionId: true, fromStatus: true, toStatus: true, actionType: true, actionBy: true, occurredAt: true },
    });
    return rows.map((r: (typeof rows)[number]) => ({
      id: r.id, questionId: r.questionId, fromStatus: r.fromStatus, toStatus: r.toStatus,
      action: r.actionType, actorId: r.actionBy, occurredAt: r.occurredAt.toISOString(),
    }));
  }

  // ── Dashboard overview (cached) ────────────────────────────────────────────────

  async getDashboardOverview() {
    const key = this.cache.buildKey(CacheNamespace.DASHBOARD, DASHBOARD_CACHE_KEY);
    return this.cache.remember(key, CacheTTL.DASHBOARD, async () => {
      const [counts, subjects, authors, reviewers, queue, activity] = await Promise.all([
        this.getStatusCounts(),
        this.getSubjectStatistics(),
        this.getAuthorStatistics(),
        this.getReviewerStatistics(),
        this.getReviewQueue(),
        this.getRecentActivity(),
      ]);
      return {
        counts,
        subjectStatistics: subjects,
        authorStatistics: authors,
        reviewerStatistics: reviewers,
        reviewQueue: queue,
        recentActivity: activity,
        generatedAt: new Date().toISOString(),
      };
    });
  }

  // ── Advanced CMS search ─────────────────────────────────────────────────────

  async search(query: CmsSearchDto, _user: AuthenticatedUser) {
    const where = this.buildWhere(query);
    const [rows, total] = await Promise.all([
      this.prisma.question.findMany({
        where, orderBy: { id: 'asc' }, take: query.limit + 1,
        select: {
          id: true, questionCode: true, subjectId: true, topicId: true, subtopicId: true,
          difficultyLevelId: true, stemText: true, questionStatus: true, bloomLevel: true,
          authorId: true, reviewerId: true, currentVersion: true, createdAt: true, updatedAt: true, publishedAt: true,
        },
      }),
      this.prisma.question.count({ where }),
    ]);
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const cursor = hasMore && page.length > 0 ? page[page.length - 1]!.id : null;
    return {
      data: page.map((q: (typeof page)[number]) => ({
        id: q.id, questionCode: q.questionCode, subjectId: q.subjectId, topicId: q.topicId,
        subtopicId: q.subtopicId, difficultyLevelId: q.difficultyLevelId, stemText: q.stemText,
        status: q.questionStatus, bloomLevel: q.bloomLevel, authorId: q.authorId, reviewerId: q.reviewerId,
        version: q.currentVersion, createdAt: q.createdAt.toISOString(), updatedAt: q.updatedAt.toISOString(),
        publishedAt: q.publishedAt?.toISOString() ?? null,
      })),
      pagination: { cursor, hasMore, total },
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private buildWhere(query: CmsSearchDto): Prisma.QuestionWhereInput {
    const createdAt = (query.createdFrom || query.createdTo) ? {
      ...(query.createdFrom && { gte: new Date(query.createdFrom) }),
      ...(query.createdTo && { lte: new Date(query.createdTo) }),
    } : undefined;
    const updatedAt = (query.updatedFrom || query.updatedTo) ? {
      ...(query.updatedFrom && { gte: new Date(query.updatedFrom) }),
      ...(query.updatedTo && { lte: new Date(query.updatedTo) }),
    } : undefined;

    return {
      deletedAt: null,
      ...(query.subjectId && { subjectId: query.subjectId }),
      ...(query.topicId && { topicId: query.topicId }),
      ...(query.subtopicId && { subtopicId: query.subtopicId }),
      ...(query.difficultyLevelId && { difficultyLevelId: query.difficultyLevelId }),
      ...(query.bloomLevel && { bloomLevel: query.bloomLevel as Prisma.QuestionWhereInput['bloomLevel'] }),
      ...(query.status && { questionStatus: query.status as QuestionStatus }),
      ...(query.authorId && { authorId: query.authorId }),
      ...(query.reviewerId && { reviewerId: query.reviewerId }),
      ...(query.learningObjective && { learningObjective: { contains: query.learningObjective, mode: 'insensitive' } }),
      ...(query.tag && { questionTags: { some: { tagId: query.tag } } }),
      ...(query.q && {
        OR: [
          { stemText: { contains: query.q, mode: 'insensitive' } },
          { keywords: { has: query.q } },
          { questionCode: { contains: query.q.toUpperCase() } },
        ],
      }),
      ...(createdAt && { createdAt }),
      ...(updatedAt && { updatedAt }),
      ...(query.cursor && { id: { gt: query.cursor } }),
    };
  }

  private rollup(
    grouped: { questionStatus: QuestionStatus; _count: { _all: number } }[] & Record<string, unknown>[],
    key: string,
  ) {
    const map = new Map<string, { id: string; total: number; published: number; draft: number; inReview: number; archived: number }>();
    for (const g of grouped) {
      const id = (g[key] as string | null) ?? 'unassigned';
      const entry = map.get(id) ?? { id, total: 0, published: 0, draft: 0, inReview: 0, archived: 0 };
      const n = g._count._all;
      entry.total += n;
      if (g.questionStatus === QuestionStatus.published) entry.published += n;
      else if (g.questionStatus === QuestionStatus.draft) entry.draft += n;
      else if (g.questionStatus === QuestionStatus.in_review) entry.inReview += n;
      else if (g.questionStatus === QuestionStatus.archived) entry.archived += n;
      map.set(id, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }
}
