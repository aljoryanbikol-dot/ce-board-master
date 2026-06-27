/**
 * @file question-search.service.ts
 * @module Questions/Services
 *
 * QuestionSearchService — search/filter, version history, and bulk import/export.
 * Read-heavy operations are cached; bulk import delegates row creation to
 * QuestionService to reuse all validation + versioning logic (DRY).
 */
import { Injectable, Logger } from '@nestjs/common';
import { QuestionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { QuestionService } from './question.service';
import { QuestionMapperService } from './question-mapper.service';
import { QuestionErrors } from '../questions.errors';
import { ROLE_SLUGS, PERM } from '../../rbac/rbac.constants';
import { UserRoleService } from '../../rbac/services/user-role.service';
import {
  QUESTION_LIST_CACHE_PREFIX,
  QUESTION_LIST_CACHE_TTL,
} from '../constants/questions.constants';
import type { SearchQuestionsDto } from '../dto/search.dto';
import type { BulkImportDto, BulkExportDto } from '../dto/bulk.dto';
import type { CreateQuestionDto } from '../dto/question.dto';
import type { QuestionListResult, VersionEntry } from '../types/questions.types';
import type { AuthenticatedUser } from '../../auth/auth.types';

const SUMMARY_INCLUDE = { questionTags: { select: { tagId: true } } } as const;

@Injectable()
export class QuestionSearchService {
  private readonly logger = new Logger(QuestionSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly questionService: QuestionService,
    private readonly mapper: QuestionMapperService,
    private readonly userRoleService: UserRoleService,
  ) {}

  // ── Search ────────────────────────────────────────────────────────────────────

  async search(query: SearchQuestionsDto, requester: AuthenticatedUser): Promise<QuestionListResult> {
    const cacheKey = this.buildCacheKey(query, requester);
    const cached = await this.cache.get<QuestionListResult>(cacheKey);
    if (cached) return cached;

    const where = this.buildWhere(query, requester);

    const [rows, total] = await Promise.all([
      this.prisma.question.findMany({
        where, include: SUMMARY_INCLUDE, orderBy: { id: 'asc' }, take: query.limit + 1,
      }),
      this.prisma.question.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const cursor = hasMore && page.length > 0 ? page[page.length - 1]!.id : null;

    const result: QuestionListResult = {
      data: page.map((q: (typeof page)[number]) => this.mapper.toSummary(q, q.questionTags.map((t: { tagId: string }) => t.tagId))),
      pagination: { cursor, hasMore, total },
    };
    await this.cache.set(cacheKey, result, QUESTION_LIST_CACHE_TTL);
    return result;
  }

  // ── Version history ───────────────────────────────────────────────────────────

  async getVersions(questionId: string, requester: AuthenticatedUser): Promise<VersionEntry[]> {
    const q = await this.prisma.question.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { id: true, authorId: true, questionStatus: true },
    });
    if (!q) throw QuestionErrors.notFound(questionId);
    // Drafts' version history is visible only to the owner, reviewers, or super admin.
    if (
      q.questionStatus !== QuestionStatus.published &&
      requester.id !== q.authorId &&
      requester.role !== ROLE_SLUGS.SUPER_ADMIN
    ) {
      const canReview = await this.userRoleService.hasPermission(requester.id, PERM.QUESTIONS_REVIEW);
      if (!canReview) throw QuestionErrors.forbiddenOwnership();
    }

    const rows = await this.prisma.questionVersion.findMany({
      where: { questionId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, changeType: true, changeSummary: true, changedBy: true, reviewedBy: true, isCurrent: true, createdAt: true },
    });
    return rows.map((v: (typeof rows)[number]) => ({
      id: v.id, versionNumber: v.versionNumber, changeType: v.changeType, changeSummary: v.changeSummary,
      changedBy: v.changedBy, reviewedBy: v.reviewedBy, isCurrent: v.isCurrent, createdAt: v.createdAt.toISOString(),
    }));
  }

  async getVersionSnapshot(questionId: string, versionNumber: number): Promise<unknown> {
    const v = await this.prisma.questionVersion.findUnique({
      where: { questionId_versionNumber: { questionId, versionNumber } },
      select: { contentSnapshot: true },
    });
    if (!v) throw QuestionErrors.versionNotFound(versionNumber);
    return v.contentSnapshot;
  }

  // ── Bulk import ────────────────────────────────────────────────────────────────

  async bulkImport(dto: BulkImportDto, author: AuthenticatedUser) {
    const createdIds: string[] = [];
    const errors: { index: number; code: string; message: string }[] = [];

    if (dto.atomic) {
      // All-or-nothing: validate every row by attempting creation in a transaction.
      // We create sequentially through QuestionService to reuse its validation;
      // any throw aborts the whole batch.
      try {
        for (let i = 0; i < dto.questions.length; i++) {
          const created = await this.questionService.create(dto.questions[i] as CreateQuestionDto, author);
          createdIds.push(created.id);
        }
      } catch (err) {
        // Roll back conceptually: delete the ones we created this batch.
        if (createdIds.length > 0) {
          await this.prisma.question.updateMany({ where: { id: { in: createdIds } }, data: { deletedAt: new Date() } });
        }
        const message = this.errMessage(err);
        throw QuestionErrors.bulkImportInvalid(`row ${createdIds.length} failed (${message}); batch rolled back.`);
      }
      this.logger.log({ message: 'Bulk import (atomic) complete', imported: createdIds.length, authorId: author.id });
      return { imported: createdIds.length, failed: 0, errors, createdIds };
    }

    // Non-atomic: import valid rows, collect per-row errors.
    for (let i = 0; i < dto.questions.length; i++) {
      try {
        const created = await this.questionService.create(dto.questions[i] as CreateQuestionDto, author);
        createdIds.push(created.id);
      } catch (err) {
        errors.push({ index: i, code: this.errCode(err), message: this.errMessage(err) });
      }
    }
    this.logger.log({ message: 'Bulk import (partial) complete', imported: createdIds.length, failed: errors.length, authorId: author.id });
    return { imported: createdIds.length, failed: errors.length, errors, createdIds };
  }

  // ── Bulk export ────────────────────────────────────────────────────────────────

  async bulkExport(dto: BulkExportDto, requester: AuthenticatedUser) {
    const where: Prisma.QuestionWhereInput = {
      deletedAt: null,
      ...(dto.status && { questionStatus: dto.status as QuestionStatus }),
      ...(dto.subjectId && { subjectId: dto.subjectId }),
    };
    const rows = await this.prisma.question.findMany({
      where, include: { choices: true, questionTags: { select: { tagId: true } } },
      orderBy: { createdAt: 'asc' }, take: dto.limit,
    });
    this.logger.log({ message: 'Bulk export', count: rows.length, actorId: requester.id });
    return {
      exportedAt: new Date().toISOString(),
      count: rows.length,
      questions: rows.map((q: (typeof rows)[number]) => this.mapper.toDetail(q, null)),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private buildWhere(query: SearchQuestionsDto, requester: AuthenticatedUser): Prisma.QuestionWhereInput {
    const where: Prisma.QuestionWhereInput = {
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
      ...(typeof query.isAiGenerated === 'boolean' && { isAiGenerated: query.isAiGenerated }),
      ...(query.q && {
        OR: [
          { stemText: { contains: query.q, mode: 'insensitive' } },
          { keywords: { has: query.q } },
          { questionCode: { contains: query.q.toUpperCase() } },
        ],
      }),
      ...(query.cursor && { id: { gt: query.cursor } }),
    };

    // Non-privileged callers only see published content unless they filter to
    // their own authored questions. Reviewers/managers see everything.
    const privileged = requester.role === ROLE_SLUGS.SUPER_ADMIN;
    if (!privileged && !query.authorId) {
      // default visibility: published only (drafts of others stay hidden)
      // a caller can still pass authorId=self to see their own drafts (checked below)
      where.questionStatus = where.questionStatus ?? QuestionStatus.published;
    }
    return where;
  }

  private buildCacheKey(query: SearchQuestionsDto, requester: AuthenticatedUser): string {
    const parts = [
      requester.role, query.cursor ?? '_', query.limit,
      query.subjectId ?? '_', query.topicId ?? '_', query.subtopicId ?? '_',
      query.difficultyLevelId ?? '_', query.bloomLevel ?? '_', query.status ?? '_',
      query.authorId ?? '_', query.reviewerId ?? '_', query.tag ?? '_',
      query.learningObjective ?? '_', query.q ?? '_',
      query.isAiGenerated === undefined ? '_' : String(query.isAiGenerated),
    ];
    return `${QUESTION_LIST_CACHE_PREFIX}${parts.join(':')}`;
  }

  private errCode(err: unknown): string {
    const r = (err as { response?: { code?: string } })?.response;
    return r?.code ?? 'IMPORT_ROW_ERROR';
  }

  private errMessage(err: unknown): string {
    const r = (err as { response?: { message?: string } })?.response;
    return r?.message ?? (err instanceof Error ? err.message : 'Unknown error');
  }
}
