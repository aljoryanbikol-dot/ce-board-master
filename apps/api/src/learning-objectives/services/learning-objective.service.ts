/**
 * @file learning-objective.service.ts
 * @module LearningObjectives/Services
 *
 * LearningObjectiveService — CRUD + lifecycle for the educational spine. Builds
 * the governing public ID (LO-<Subj>-<Topic>-<Subtopic>-<Number>), validates
 * every record against the spec via the shared ValidationEngineService, snapshots
 * each version, and enforces the publish gate (must be approved first).
 *
 * Composes the Knowledge core (PublicIdService, ValidationEngineService) rather
 * than re-implementing the rules — single source of truth.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { PublicIdService } from '../../knowledge/services/public-id.service';
import { ValidationEngineService } from '../../knowledge/services/validation-engine.service';
import { KnowledgeErrors } from '../../knowledge/knowledge.errors';
import { EVENTS } from '../../common/constants';
import { KNOWLEDGE_CACHE_PREFIX } from '../../knowledge/constants/knowledge.constants';
import type { CreateLearningObjectiveDto, UpdateLearningObjectiveDto, LoSearchDto } from '../dto/learning-objective.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class LearningObjectiveService {
  private readonly logger = new Logger(LearningObjectiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly publicId: PublicIdService,
    private readonly validator: ValidationEngineService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateLearningObjectiveDto, user: AuthenticatedUser) {
    const publicId = this.publicId.buildLearningObjectiveId(dto.subjectCode, dto.topicCode, dto.subtopicCode, dto.sequenceNumber);

    const validation = this.validator.validateLearningObjective({
      publicId, subjectCode: dto.subjectCode, statement: dto.statement, bloomLevel: dto.bloomLevel,
      semver: '1.0.0', sequenceNumber: dto.sequenceNumber,
    });
    if (!validation.valid) {
      this.eventEmitter.emit(EVENTS.KNOWLEDGE_VALIDATION_FAILED, { entity: 'learning_objective', publicId, issues: validation.issues });
      throw KnowledgeErrors.validationFailed(validation.issues);
    }

    const exists = await this.prisma.learningObjective.findUnique({ where: { publicId }, select: { id: true } });
    if (exists) throw KnowledgeErrors.publicIdTaken(publicId);

    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const lo = await tx.learningObjective.create({
        data: {
          publicId, subjectCode: dto.subjectCode,
          topicCode: this.pad(dto.topicCode), subtopicCode: this.pad(dto.subtopicCode),
          sequenceNumber: dto.sequenceNumber, statement: dto.statement, bloomLevel: dto.bloomLevel,
          measurable: dto.measurable, keywords: dto.keywords, subjectId: dto.subjectId ?? null,
          sourceDocumentId: dto.sourceDocumentId ?? null, createdBy: user.id, status: 'draft',
          currentVersion: 1, semver: '1.0.0',
        },
      });
      await tx.learningObjectiveVersion.create({
        data: {
          objectiveId: lo.id, versionNumber: 1, semver: '1.0.0',
          snapshot: this.snapshot(lo) as unknown as Prisma.InputJsonValue,
          changeSummary: 'Initial creation', changedBy: user.id, isCurrent: true,
        },
      });
      return lo;
    });

    await this.invalidate();
    this.eventEmitter.emit(EVENTS.KNOWLEDGE_LO_CREATED, { id: created.id, publicId, actorId: user.id, timestamp: new Date().toISOString() });
    this.logger.log({ message: 'Learning objective created', publicId, actorId: user.id });
    return this.toView(created);
  }

  async findById(id: string) {
    const lo = await this.prisma.learningObjective.findFirst({ where: { id, deletedAt: null } });
    if (!lo) throw KnowledgeErrors.entityNotFound('Learning Objective', id);
    return this.toView(lo);
  }

  async findByPublicId(publicId: string) {
    const lo = await this.prisma.learningObjective.findFirst({ where: { publicId, deletedAt: null } });
    if (!lo) throw KnowledgeErrors.entityNotFound('Learning Objective', publicId);
    return this.toView(lo);
  }

  async update(id: string, dto: UpdateLearningObjectiveDto, user: AuthenticatedUser) {
    const existing = await this.prisma.learningObjective.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw KnowledgeErrors.entityNotFound('Learning Objective', id);

    const nextSemver = dto.bumpMajor ? this.bumpMajor(existing.semver) : this.bumpMinor(existing.semver);
    const nextVersion = existing.currentVersion + 1;

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const lo = await tx.learningObjective.update({
        where: { id },
        data: {
          ...(dto.statement !== undefined && { statement: dto.statement }),
          ...(dto.bloomLevel !== undefined && { bloomLevel: dto.bloomLevel }),
          ...(dto.measurable !== undefined && { measurable: dto.measurable }),
          ...(dto.keywords !== undefined && { keywords: dto.keywords }),
          currentVersion: nextVersion, semver: nextSemver,
        },
      });
      await tx.learningObjectiveVersion.updateMany({ where: { objectiveId: id, isCurrent: true }, data: { isCurrent: false } });
      await tx.learningObjectiveVersion.create({
        data: {
          objectiveId: id, versionNumber: nextVersion, semver: nextSemver,
          snapshot: this.snapshot(lo) as unknown as Prisma.InputJsonValue,
          changeSummary: dto.changeSummary ?? 'Updated', changedBy: user.id, isCurrent: true,
        },
      });
      return lo;
    });

    await this.invalidate();
    this.eventEmitter.emit(EVENTS.KNOWLEDGE_LO_UPDATED, { id, publicId: updated.publicId, version: nextVersion, actorId: user.id, timestamp: new Date().toISOString() });
    return this.toView(updated);
  }

  async submitForReview(id: string) { return this.setStatus(id, 'in_review', ['draft']); }
  async approve(id: string) { return this.setStatus(id, 'approved', ['in_review']); }

  async publish(id: string, user: AuthenticatedUser) {
    const lo = await this.prisma.learningObjective.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
    if (!lo) throw KnowledgeErrors.entityNotFound('Learning Objective', id);
    if (lo.status !== 'approved') throw KnowledgeErrors.notPublishable(lo.status);
    const updated = await this.prisma.learningObjective.update({ where: { id }, data: { status: 'published' } });
    await this.invalidate();
    this.eventEmitter.emit(EVENTS.KNOWLEDGE_LO_PUBLISHED, { id, publicId: updated.publicId, actorId: user.id, timestamp: new Date().toISOString() });
    return this.toView(updated);
  }

  async getVersions(id: string) {
    const lo = await this.prisma.learningObjective.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!lo) throw KnowledgeErrors.entityNotFound('Learning Objective', id);
    const versions = await this.prisma.learningObjectiveVersion.findMany({ where: { objectiveId: id }, orderBy: { versionNumber: 'desc' } });
    return versions.map((v: (typeof versions)[number]) => ({
      id: v.id, versionNumber: v.versionNumber, semver: v.semver, changeSummary: v.changeSummary,
      changedBy: v.changedBy, isCurrent: v.isCurrent, createdAt: v.createdAt.toISOString(),
    }));
  }

  async search(dto: LoSearchDto) {
    const where: Prisma.LearningObjectiveWhereInput = {
      deletedAt: null,
      ...(dto.subjectCode && { subjectCode: dto.subjectCode }),
      ...(dto.topicCode && { topicCode: dto.topicCode }),
      ...(dto.status && { status: dto.status as never }),
      ...(dto.bloomLevel && { bloomLevel: dto.bloomLevel }),
      ...(dto.q && { OR: [{ statement: { contains: dto.q, mode: 'insensitive' } }, { publicId: { contains: dto.q.toUpperCase() } }, { keywords: { has: dto.q } }] }),
      ...(dto.cursor && { id: { gt: dto.cursor } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.learningObjective.findMany({ where, orderBy: { id: 'asc' }, take: dto.limit + 1 }),
      this.prisma.learningObjective.count({ where }),
    ]);
    const hasMore = rows.length > dto.limit;
    const page = hasMore ? rows.slice(0, dto.limit) : rows;
    return {
      data: page.map((lo: (typeof page)[number]) => this.toView(lo)),
      pagination: { cursor: hasMore && page.length ? page[page.length - 1]!.id : null, hasMore, total },
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async setStatus(id: string, status: string, allowedFrom: string[]) {
    const lo = await this.prisma.learningObjective.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
    if (!lo) throw KnowledgeErrors.entityNotFound('Learning Objective', id);
    if (!allowedFrom.includes(lo.status)) throw KnowledgeErrors.notPublishable(lo.status);
    const updated = await this.prisma.learningObjective.update({ where: { id }, data: { status: status as never } });
    await this.invalidate();
    return this.toView(updated);
  }

  private pad(n: number): string { return String(n).padStart(3, '0'); }
  private bumpMinor(s: string): string { const [a, b] = s.split('.').map(Number); return `${a ?? 1}.${(b ?? 0) + 1}.0`; }
  private bumpMajor(s: string): string { const [a] = s.split('.').map(Number); return `${(a ?? 1) + 1}.0.0`; }
  private async invalidate() { await this.cache.invalidatePattern(`${KNOWLEDGE_CACHE_PREFIX}*`); }

  private snapshot(lo: Record<string, unknown>) {
    return {
      publicId: lo.publicId, statement: lo.statement, bloomLevel: lo.bloomLevel,
      measurable: lo.measurable, keywords: lo.keywords, status: lo.status, semver: lo.semver,
    };
  }

  private toView(lo: {
    id: string; publicId: string; subjectCode: string; topicCode: string; subtopicCode: string;
    sequenceNumber: number; statement: string; bloomLevel: string; measurable: boolean; status: string;
    currentVersion: number; semver: string; keywords: string[]; subjectId: string | null;
    createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: lo.id, publicId: lo.publicId, subjectCode: lo.subjectCode, topicCode: lo.topicCode, subtopicCode: lo.subtopicCode,
      sequenceNumber: lo.sequenceNumber, statement: lo.statement, bloomLevel: lo.bloomLevel, measurable: lo.measurable,
      status: lo.status, currentVersion: lo.currentVersion, semver: lo.semver, keywords: lo.keywords, subjectId: lo.subjectId,
      createdAt: lo.createdAt.toISOString(), updatedAt: lo.updatedAt.toISOString(),
    };
  }
}
