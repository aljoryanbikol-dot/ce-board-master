/**
 * @file misconception.service.ts
 * @module Misconceptions/Services
 *
 * MisconceptionService — CRUD + lifecycle for Misconceptions. Builds the
 * MC-<...> public ID, validates against the spec (Book 13), and gates
 * publication. Mirrors BlueprintService; composes the Knowledge core.
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
import type { CreateMisconceptionDto, MisconceptionSearchDto } from '../dto/misconception.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class MisconceptionService {
  private readonly logger = new Logger(MisconceptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly publicId: PublicIdService,
    private readonly validator: ValidationEngineService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateMisconceptionDto, user: AuthenticatedUser) {
    const publicId = this.publicId.buildMisconceptionId(dto.subjectCode, dto.topicCode, dto.subtopicCode, dto.category, dto.sequenceNumber);
    const validation = this.validator.validateMisconception({ publicId, subjectCode: dto.subjectCode, category: dto.category, title: dto.title, description: dto.description, semver: '1.0.0' });
    if (!validation.valid) {
      this.eventEmitter.emit(EVENTS.KNOWLEDGE_VALIDATION_FAILED, { entity: 'misconception', publicId, issues: validation.issues });
      throw KnowledgeErrors.validationFailed(validation.issues);
    }
    const exists = await this.prisma.misconception.findUnique({ where: { publicId }, select: { id: true } });
    if (exists) throw KnowledgeErrors.publicIdTaken(publicId);

    const mc = await this.prisma.misconception.create({
      data: {
        publicId, subjectCode: dto.subjectCode, topicCode: this.pad(dto.topicCode), subtopicCode: this.pad(dto.subtopicCode),
        category: dto.category, sequenceNumber: dto.sequenceNumber, title: dto.title, description: dto.description,
        whyItHappens: dto.whyItHappens ?? null, correction: dto.correction ?? null,
        primaryObjectiveId: dto.primaryObjectiveId ?? null, sourceDocumentId: dto.sourceDocumentId ?? null,
        createdBy: user.id, status: 'draft', currentVersion: 1, semver: '1.0.0',
      },
    });
    await this.invalidate();
    this.eventEmitter.emit(EVENTS.KNOWLEDGE_MISCONCEPTION_CREATED, { id: mc.id, publicId, actorId: user.id, timestamp: new Date().toISOString() });
    this.logger.log({ message: 'Misconception created', publicId });
    return this.toView(mc);
  }

  async findById(id: string) {
    const mc = await this.prisma.misconception.findFirst({ where: { id, deletedAt: null } });
    if (!mc) throw KnowledgeErrors.entityNotFound('Misconception', id);
    return this.toView(mc);
  }

  async publish(id: string, _user: AuthenticatedUser) {
    const mc = await this.prisma.misconception.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
    if (!mc) throw KnowledgeErrors.entityNotFound('Misconception', id);
    if (mc.status !== 'approved') throw KnowledgeErrors.notPublishable(mc.status);
    const updated = await this.prisma.misconception.update({ where: { id }, data: { status: 'published' } });
    await this.invalidate();
    return this.toView(updated);
  }

  async setStatus(id: string, status: string, allowedFrom: string[]) {
    const mc = await this.prisma.misconception.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
    if (!mc) throw KnowledgeErrors.entityNotFound('Misconception', id);
    if (!allowedFrom.includes(mc.status)) throw KnowledgeErrors.notPublishable(mc.status);
    const updated = await this.prisma.misconception.update({ where: { id }, data: { status: status as never } });
    await this.invalidate();
    return this.toView(updated);
  }

  async search(dto: MisconceptionSearchDto) {
    const where: Prisma.MisconceptionWhereInput = {
      deletedAt: null,
      ...(dto.subjectCode && { subjectCode: dto.subjectCode }),
      ...(dto.category && { category: dto.category }),
      ...(dto.status && { status: dto.status as never }),
      ...(dto.q && { OR: [{ title: { contains: dto.q, mode: 'insensitive' } }, { description: { contains: dto.q, mode: 'insensitive' } }, { publicId: { contains: dto.q.toUpperCase() } }] }),
      ...(dto.cursor && { id: { gt: dto.cursor } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.misconception.findMany({ where, orderBy: { id: 'asc' }, take: dto.limit + 1 }),
      this.prisma.misconception.count({ where }),
    ]);
    const hasMore = rows.length > dto.limit;
    const page = hasMore ? rows.slice(0, dto.limit) : rows;
    return {
      data: page.map((mc: (typeof page)[number]) => this.toView(mc)),
      pagination: { cursor: hasMore && page.length ? page[page.length - 1]!.id : null, hasMore, total },
    };
  }

  private pad(n: number): string { return String(n).padStart(3, '0'); }
  private async invalidate() { await this.cache.invalidatePattern(`${KNOWLEDGE_CACHE_PREFIX}*`); }

  private toView(mc: {
    id: string; publicId: string; subjectCode: string; topicCode: string; subtopicCode: string;
    category: string; sequenceNumber: number; title: string; description: string; whyItHappens: string | null;
    correction: string | null; primaryObjectiveId: string | null; status: string; currentVersion: number;
    semver: string; createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: mc.id, publicId: mc.publicId, subjectCode: mc.subjectCode, topicCode: mc.topicCode, subtopicCode: mc.subtopicCode,
      category: mc.category, sequenceNumber: mc.sequenceNumber, title: mc.title, description: mc.description,
      whyItHappens: mc.whyItHappens, correction: mc.correction, primaryObjectiveId: mc.primaryObjectiveId,
      status: mc.status, currentVersion: mc.currentVersion, semver: mc.semver,
      createdAt: mc.createdAt.toISOString(), updatedAt: mc.updatedAt.toISOString(),
    };
  }
}
