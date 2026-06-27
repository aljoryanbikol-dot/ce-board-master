/**
 * @file question.service.ts
 * @module Questions/Services
 *
 * QuestionService — CRUD + clone for the Question Bank.
 *
 * Responsibilities:
 *  - create (draft), read (detail/cache), update (optimistic-locked + versioned),
 *    soft-delete, clone
 *  - ownership / admin / super_admin authorization
 *  - answer-choice persistence (replace-on-update)
 *  - tag association
 *  - version snapshot on every content change (delegates row write to mapper)
 *  - cache management + audit events
 *
 * Workflow transitions (submit/approve/reject/publish/archive) live in
 * QuestionWorkflowService; search/bulk live in QuestionSearchService. This
 * keeps each service single-responsibility.
 *
 * Authorization model:
 *  - create: questions.create (guard) — author = caller
 *  - read:   questions.read (guard); published readable by any reader, drafts
 *            only by owner or questions.manage
 *  - update/delete: questions.update/delete (guard) AND (owner OR questions.manage)
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChangeType, Prisma, QuestionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { UserRoleService } from '../../rbac/services/user-role.service';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import { EVENTS } from '../../common/constants';
import { QuestionMapperService } from './question-mapper.service';
import { QuestionErrors } from '../questions.errors';
import {
  QUESTION_CACHE_PREFIX,
  QUESTION_CACHE_TTL,
  QUESTION_LIST_CACHE_PREFIX,
  CHOICE_LETTERS,
} from '../constants/questions.constants';
import type { CreateQuestionDto, UpdateQuestionDto } from '../dto/question.dto';
import type { QuestionDetail } from '../types/questions.types';
import type { AuthenticatedUser } from '../../auth/auth.types';

const QUESTION_INCLUDE = {
  choices: true,
  questionTags: { select: { tagId: true } },
} as const;

@Injectable()
export class QuestionService {
  private readonly logger = new Logger(QuestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly userRoleService: UserRoleService,
    private readonly mapper: QuestionMapperService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────────

  async create(dto: CreateQuestionDto, author: AuthenticatedUser): Promise<QuestionDetail> {
    await this.assertCodeAvailable(dto.questionCode);
    await this.assertTaxonomyExists(dto.subjectId, dto.topicId, dto.subtopicId, dto.difficultyLevelId);
    this.assertChoicesValid(dto.choices, dto.correctChoice);

    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const q = await tx.question.create({
        data: {
          questionCode:      dto.questionCode,
          subjectId:         dto.subjectId,
          topicId:           dto.topicId,
          subtopicId:        dto.subtopicId,
          difficultyLevelId: dto.difficultyLevelId,
          stemText:          dto.stemText,
          stemLatex:         dto.stemLatex ?? null,
          stemHtml:          dto.stemHtml ?? null,
          correctChoice:     dto.correctChoice,
          explanationText:   dto.explanationText,
          explanationLatex:  dto.explanationLatex ?? null,
          explanationHtml:   dto.explanationHtml ?? null,
          bloomLevel:        dto.bloomLevel,
          questionType:      dto.questionType,
          learningObjective: dto.learningObjective ?? null,
          prcSyllabusRef:    dto.prcSyllabusRef ?? null,
          estSolvingTimeSec: dto.estSolvingTimeSec,
          language:          dto.language,
          keywords:          dto.keywords,
          authorId:          author.id,
          isAiGenerated:     dto.isAiGenerated,
          questionStatus:    QuestionStatus.draft,
          currentVersion:    1,
          choices: {
            create: dto.choices.map((c) => ({
              choiceLetter: c.letter,
              choiceText:   c.text,
              choiceLatex:  c.latex ?? null,
              choiceHtml:   c.html ?? null,
              explanation:  c.explanation ?? null,
              isCorrect:    c.letter === dto.correctChoice,
              sortOrder:    c.sortOrder ?? CHOICE_LETTERS.indexOf(c.letter),
            })),
          },
          ...(dto.tags.length > 0 && {
            questionTags: { create: dto.tags.map((tagId) => ({ tagId })) },
          }),
        },
        include: QUESTION_INCLUDE,
      });

      // Initial version snapshot
      await tx.questionVersion.create({
        data: {
          questionId:      q.id,
          versionNumber:   1,
          contentSnapshot: this.mapper.buildSnapshot(q, null) as unknown as Prisma.InputJsonValue,
          changeType:      ChangeType.create,
          changeSummary:   'Initial draft',
          changedBy:       author.id,
          isCurrent:       true,
        },
      });
      return q;
    });

    await this.invalidateListCaches();
    this.eventEmitter.emit(EVENTS.QUESTION_CREATED, {
      questionId: created.id, authorId: author.id, code: created.questionCode, timestamp: new Date().toISOString(),
    });
    this.logger.log({ message: 'Question created', questionId: created.id, code: created.questionCode, authorId: author.id });

    return this.mapper.toDetail(created, null);
  }

  // ── Read ──────────────────────────────────────────────────────────────────────

  async findById(id: string, requester: AuthenticatedUser): Promise<QuestionDetail> {
    const cacheKey = `${QUESTION_CACHE_PREFIX}${id}`;
    const cached = await this.cache.get<QuestionDetail>(cacheKey);
    if (cached) {
      await this.assertCanRead(cached.authorId, cached.status, requester);
      return cached;
    }

    const q = await this.prisma.question.findFirst({
      where: { id, deletedAt: null },
      include: QUESTION_INCLUDE,
    });
    if (!q) throw QuestionErrors.notFound(id);

    await this.assertCanRead(q.authorId, q.questionStatus, requester);

    const stage = await this.resolveReviewStage(id, q.questionStatus);
    const detail = this.mapper.toDetail(q, stage);
    await this.cache.set(cacheKey, detail, QUESTION_CACHE_TTL);
    return detail;
  }

  // ── Update ──────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateQuestionDto, requester: AuthenticatedUser): Promise<QuestionDetail> {
    const existing = await this.prisma.question.findFirst({
      where: { id, deletedAt: null },
      include: QUESTION_INCLUDE,
    });
    if (!existing) throw QuestionErrors.notFound(id);
    await this.assertCanModify(existing.authorId, requester);

    // Optimistic locking
    if (dto.version !== undefined && dto.version !== existing.currentVersion) {
      throw QuestionErrors.versionConflict();
    }

    // Validate choices if provided
    const newCorrect = dto.correctChoice ?? existing.correctChoice;
    if (dto.choices) this.assertChoicesValid(dto.choices, newCorrect);
    if (dto.subtopicId || dto.difficultyLevelId) {
      await this.assertTaxonomyExists(
        existing.subjectId, existing.topicId,
        dto.subtopicId ?? existing.subtopicId,
        dto.difficultyLevelId ?? existing.difficultyLevelId,
      );
    }

    const nextVersion = existing.currentVersion + 1;

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Replace choices if supplied
      if (dto.choices) {
        await tx.questionChoice.deleteMany({ where: { questionId: id } });
        await tx.questionChoice.createMany({
          data: dto.choices.map((c) => ({
            questionId:   id,
            choiceLetter: c.letter,
            choiceText:   c.text,
            choiceLatex:  c.latex ?? null,
            choiceHtml:   c.html ?? null,
            explanation:  c.explanation ?? null,
            isCorrect:    c.letter === newCorrect,
            sortOrder:    c.sortOrder ?? CHOICE_LETTERS.indexOf(c.letter),
          })),
        });
      }

      // Replace tags if supplied
      if (dto.tags) {
        await tx.questionTag.deleteMany({ where: { questionId: id } });
        if (dto.tags.length > 0) {
          await tx.questionTag.createMany({ data: dto.tags.map((tagId) => ({ questionId: id, tagId })) });
        }
      }

      const q = await tx.question.update({
        where: { id },
        data: {
          ...(dto.stemText          !== undefined && { stemText: dto.stemText }),
          ...(dto.stemLatex         !== undefined && { stemLatex: dto.stemLatex }),
          ...(dto.stemHtml          !== undefined && { stemHtml: dto.stemHtml }),
          ...(dto.correctChoice     !== undefined && { correctChoice: dto.correctChoice }),
          ...(dto.explanationText   !== undefined && { explanationText: dto.explanationText }),
          ...(dto.explanationLatex  !== undefined && { explanationLatex: dto.explanationLatex }),
          ...(dto.explanationHtml   !== undefined && { explanationHtml: dto.explanationHtml }),
          ...(dto.bloomLevel        !== undefined && { bloomLevel: dto.bloomLevel }),
          ...(dto.questionType      !== undefined && { questionType: dto.questionType }),
          ...(dto.learningObjective !== undefined && { learningObjective: dto.learningObjective }),
          ...(dto.prcSyllabusRef    !== undefined && { prcSyllabusRef: dto.prcSyllabusRef }),
          ...(dto.estSolvingTimeSec !== undefined && { estSolvingTimeSec: dto.estSolvingTimeSec }),
          ...(dto.difficultyLevelId !== undefined && { difficultyLevelId: dto.difficultyLevelId }),
          ...(dto.subtopicId        !== undefined && { subtopicId: dto.subtopicId }),
          ...(dto.keywords          !== undefined && { keywords: dto.keywords }),
          currentVersion: nextVersion,
        },
        include: QUESTION_INCLUDE,
      });

      // Mark previous versions non-current, write new snapshot
      await tx.questionVersion.updateMany({ where: { questionId: id, isCurrent: true }, data: { isCurrent: false } });
      await tx.questionVersion.create({
        data: {
          questionId:      id,
          versionNumber:   nextVersion,
          contentSnapshot: this.mapper.buildSnapshot(q, null) as unknown as Prisma.InputJsonValue,
          changeType:      ChangeType.edit,
          changeSummary:   dto.changeSummary ?? 'Edited question content',
          changedBy:       requester.id,
          isCurrent:       true,
        },
      });
      return q;
    });

    await this.invalidateCaches(id);
    this.eventEmitter.emit(EVENTS.QUESTION_UPDATED, {
      questionId: id, actorId: requester.id, version: nextVersion, timestamp: new Date().toISOString(),
    });
    this.logger.log({ message: 'Question updated', questionId: id, version: nextVersion, actorId: requester.id });

    const stage = await this.resolveReviewStage(id, updated.questionStatus);
    return this.mapper.toDetail(updated, stage);
  }

  // ── Soft-delete ────────────────────────────────────────────────────────────────

  async softDelete(id: string, requester: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.question.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true, questionStatus: true },
    });
    if (!existing) throw QuestionErrors.notFound(id);
    await this.assertCanModify(existing.authorId, requester);

    // Published questions must be archived, not deleted
    if (existing.questionStatus === QuestionStatus.published) {
      throw QuestionErrors.cannotDeletePublished();
    }

    await this.prisma.question.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.invalidateCaches(id);
    this.eventEmitter.emit(EVENTS.QUESTION_DELETED, {
      questionId: id, actorId: requester.id, timestamp: new Date().toISOString(),
    });
    this.logger.warn({ message: 'Question soft-deleted', questionId: id, actorId: requester.id });
  }

  // ── Clone ──────────────────────────────────────────────────────────────────────

  async clone(id: string, requester: AuthenticatedUser): Promise<QuestionDetail> {
    const source = await this.prisma.question.findFirst({
      where: { id, deletedAt: null },
      include: QUESTION_INCLUDE,
    });
    if (!source) throw QuestionErrors.notFound(id);
    // Anyone who can read may clone into their own new draft.
    await this.assertCanRead(source.authorId, source.questionStatus, requester);

    const newCode = await this.deriveCloneCode(source.questionCode);

    const cloned = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const q = await tx.question.create({
        data: {
          questionCode:      newCode,
          subjectId:         source.subjectId,
          topicId:           source.topicId,
          subtopicId:        source.subtopicId,
          difficultyLevelId: source.difficultyLevelId,
          stemText:          source.stemText,
          stemLatex:         source.stemLatex,
          stemHtml:          source.stemHtml,
          correctChoice:     source.correctChoice,
          explanationText:   source.explanationText,
          explanationLatex:  source.explanationLatex,
          explanationHtml:   source.explanationHtml,
          bloomLevel:        source.bloomLevel,
          questionType:      source.questionType,
          learningObjective: source.learningObjective,
          prcSyllabusRef:    source.prcSyllabusRef,
          estSolvingTimeSec: source.estSolvingTimeSec,
          language:          source.language,
          keywords:          source.keywords,
          authorId:          requester.id,
          isAiGenerated:     source.isAiGenerated,
          questionStatus:    QuestionStatus.draft,
          currentVersion:    1,
          choices: {
            create: source.choices.map((c: (typeof source.choices)[number]) => ({
              choiceLetter: c.choiceLetter, choiceText: c.choiceText, choiceLatex: c.choiceLatex,
              choiceHtml: c.choiceHtml, explanation: c.explanation, isCorrect: c.isCorrect, sortOrder: c.sortOrder,
            })),
          },
          ...(source.questionTags.length > 0 && {
            questionTags: { create: source.questionTags.map((t: { tagId: string }) => ({ tagId: t.tagId })) },
          }),
        },
        include: QUESTION_INCLUDE,
      });
      await tx.questionVersion.create({
        data: {
          questionId: q.id, versionNumber: 1,
          contentSnapshot: this.mapper.buildSnapshot(q, null) as unknown as Prisma.InputJsonValue,
          changeType: ChangeType.create, changeSummary: `Cloned from ${source.questionCode}`,
          changedBy: requester.id, isCurrent: true,
        },
      });
      return q;
    });

    await this.invalidateListCaches();
    this.eventEmitter.emit(EVENTS.QUESTION_CLONED, {
      questionId: cloned.id, sourceId: id, actorId: requester.id, timestamp: new Date().toISOString(),
    });
    this.logger.log({ message: 'Question cloned', sourceId: id, newId: cloned.id, actorId: requester.id });

    return this.mapper.toDetail(cloned, null);
  }

  // ── Authorization helpers ────────────────────────────────────────────────────

  private async assertCanRead(authorId: string, status: string, requester: AuthenticatedUser): Promise<void> {
    // Published/archived/flagged content is readable by anyone with questions.read (guard already enforced).
    if (status === QuestionStatus.published || status === QuestionStatus.archived || status === QuestionStatus.flagged) return;
    // Drafts / in-review / approved: owner or manager only.
    if (requester.id === authorId) return;
    if (requester.role === ROLE_SLUGS.SUPER_ADMIN) return;
    const hasManage = await this.userRoleService.hasPermission(requester.id, PERM.QUESTIONS_MANAGE);
    const hasReview = await this.userRoleService.hasPermission(requester.id, PERM.QUESTIONS_REVIEW);
    if (!hasManage && !hasReview) throw QuestionErrors.forbiddenOwnership();
  }

  private async assertCanModify(authorId: string, requester: AuthenticatedUser): Promise<void> {
    if (requester.id === authorId) return;
    if (requester.role === ROLE_SLUGS.SUPER_ADMIN) return;
    const hasManage = await this.userRoleService.hasPermission(requester.id, PERM.QUESTIONS_MANAGE);
    if (!hasManage) throw QuestionErrors.forbiddenOwnership();
  }

  // ── Validation helpers ────────────────────────────────────────────────────────

  private assertChoicesValid(
    choices: { letter: string }[],
    correctChoice: string,
  ): void {
    const letters = choices.map((c) => c.letter);
    const unique = new Set(letters);
    if (unique.size !== letters.length) throw QuestionErrors.choicesInvalid('Choice letters must be unique.');
    const required = new Set(CHOICE_LETTERS);
    for (const l of letters) if (!required.has(l as (typeof CHOICE_LETTERS)[number])) throw QuestionErrors.choicesInvalid(`Unexpected choice letter '${l}'.`);
    if (!letters.includes(correctChoice)) throw QuestionErrors.correctChoiceInvalid();
  }

  private async assertCodeAvailable(code: string): Promise<void> {
    const existing = await this.prisma.question.findUnique({ where: { questionCode: code }, select: { id: true } });
    if (existing) throw QuestionErrors.codeTaken(code);
  }

  private async assertTaxonomyExists(subjectId: string, topicId: string, subtopicId: string, difficultyLevelId: string): Promise<void> {
    const [subject, topic, subtopic, difficulty] = await Promise.all([
      this.prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } }),
      this.prisma.topic.findUnique({ where: { id: topicId }, select: { id: true } }),
      this.prisma.subtopic.findUnique({ where: { id: subtopicId }, select: { id: true } }),
      this.prisma.difficultyLevel.findUnique({ where: { id: difficultyLevelId }, select: { id: true } }),
    ]);
    if (!subject) throw QuestionErrors.taxonomyNotFound(`subject ${subjectId}`);
    if (!topic) throw QuestionErrors.taxonomyNotFound(`topic ${topicId}`);
    if (!subtopic) throw QuestionErrors.taxonomyNotFound(`subtopic ${subtopicId}`);
    if (!difficulty) throw QuestionErrors.taxonomyNotFound(`difficulty ${difficultyLevelId}`);
  }

  private async deriveCloneCode(sourceCode: string): Promise<string> {
    // Append -COPY, -COPY2, … until unique (cap length at 30).
    for (let i = 1; i <= 99; i++) {
      const suffix = i === 1 ? '-COPY' : `-COPY${i}`;
      const candidate = (sourceCode.slice(0, 30 - suffix.length) + suffix).toUpperCase();
      const taken = await this.prisma.question.findUnique({ where: { questionCode: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    // Fallback: random suffix
    return `${sourceCode.slice(0, 22)}-${Date.now().toString(36).slice(-6)}`.toUpperCase();
  }

  /** Resolve the active review stage from the latest workflow note when in_review. */
  private async resolveReviewStage(questionId: string, status: string): Promise<import('../constants/questions.constants').ReviewStage | null> {
    if (status !== QuestionStatus.in_review) return null;
    const latest = await this.prisma.questionReviewWorkflow.findFirst({
      where: { questionId, toStatus: QuestionStatus.in_review },
      orderBy: { occurredAt: 'desc' },
      select: { notes: true },
    });
    const stage = latest?.notes?.match(/stage:(\w+)/)?.[1];
    return (stage as import('../constants/questions.constants').ReviewStage) ?? 'technical';
  }

  // ── Cache helpers ────────────────────────────────────────────────────────────

  private async invalidateCaches(id: string): Promise<void> {
    await Promise.all([
      this.cache.del(`${QUESTION_CACHE_PREFIX}${id}`),
      this.invalidateListCaches(),
    ]);
  }

  private async invalidateListCaches(): Promise<void> {
    await this.cache.invalidatePattern(`${QUESTION_LIST_CACHE_PREFIX}*`);
  }
}
