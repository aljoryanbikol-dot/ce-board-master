/**
 * @file dashboard.service.ts
 * @module Dashboard/Services
 *
 * DashboardService — the Admin CMS dashboard read model. Composes
 * CmsAnalyticsService (the aggregation engine) into the specific views the
 * brief requires: total/draft/in-review/published/archived counts, subject /
 * topic / author / reviewer statistics, recent activity, and the review queue.
 *
 * This service is a thin orchestration layer — all heavy aggregation lives in
 * CmsAnalyticsService (Single Responsibility). It exists so the DashboardModule
 * has its own boundary and can evolve (widgets, per-user dashboards) without
 * touching the CMS aggregation internals.
 */
import { Injectable } from '@nestjs/common';
import { CmsAnalyticsService } from '../../cms/services/cms-analytics.service';
import { CMS_QUEUES, type CmsQueue } from '../../cms/constants/cms.constants';
import { QuestionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class DashboardService {
  constructor(
    private readonly analytics: CmsAnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  /** The full dashboard overview (cached in the analytics layer). */
  async getOverview(_user: AuthenticatedUser) {
    return this.analytics.getDashboardOverview();
  }

  /** Just the status counts (lightweight widget). */
  async getCounts() {
    return this.analytics.getStatusCounts();
  }

  async getSubjectStatistics() { return this.analytics.getSubjectStatistics(); }
  async getTopicStatistics() { return this.analytics.getTopicStatistics(); }
  async getAuthorStatistics() { return this.analytics.getAuthorStatistics(); }
  async getReviewerStatistics() { return this.analytics.getReviewerStatistics(); }
  async getRecentActivity() { return this.analytics.getRecentActivity(); }
  async getReviewQueue() { return this.analytics.getReviewQueue(); }

  /**
   * A CMS queue (draft / review / publish / archive). Maps the queue name to a
   * question status and returns a lightweight, oldest-first list.
   */
  async getQueue(queue: CmsQueue, limit = 50) {
    const status = this.queueToStatus(queue);
    const rows = await this.prisma.question.findMany({
      where: { deletedAt: null, questionStatus: status },
      orderBy: { updatedAt: 'asc' },
      take: limit,
      select: {
        id: true, questionCode: true, subjectId: true, topicId: true,
        authorId: true, reviewerId: true, currentVersion: true, updatedAt: true, createdAt: true,
      },
    });
    return {
      queue, status, count: rows.length,
      items: rows.map((r: (typeof rows)[number]) => ({
        id: r.id, questionCode: r.questionCode, subjectId: r.subjectId, topicId: r.topicId,
        authorId: r.authorId, reviewerId: r.reviewerId, version: r.currentVersion,
        updatedAt: r.updatedAt.toISOString(), createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  private queueToStatus(queue: CmsQueue): QuestionStatus {
    switch (queue) {
      case CMS_QUEUES.DRAFT:   return QuestionStatus.draft;
      case CMS_QUEUES.REVIEW:  return QuestionStatus.in_review;
      case CMS_QUEUES.PUBLISH: return QuestionStatus.approved; // publish queue = approved, awaiting publish
      case CMS_QUEUES.ARCHIVE: return QuestionStatus.archived;
      default:                 return QuestionStatus.draft;
    }
  }
}
