/**
 * @file blueprint.service.ts
 * @module Blueprints/Services
 *
 * BlueprintService — CRUD + lifecycle for Question Blueprints. Builds the
 * BP-<...> public ID, validates against the spec, and gates publication. Mirrors
 * LearningObjectiveService; composes the Knowledge core for the governing rules.
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
import type { CreateBlueprintDto, BlueprintSearchDto } from '../dto/blueprint.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class BlueprintService {
  private readonly logger = new Logger(BlueprintService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly publicId: PublicIdService,
    private readonly validator: ValidationEngineService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateBlueprintDto, user: AuthenticatedUser) {
    const publicId = this.publicId.buildBlueprintId(dto.subjectCode, dto.topicCode, dto.subtopicCode, dto.blueprintType, dto.sequenceNumber);
    const validation = this.validator.validateBlueprint({ publicId, subjectCode: dto.subjectCode, blueprintType: dto.blueprintType, name: dto.name, semver: '1.0.0' });
    if (!validation.valid) {
      this.eventEmitter.emit(EVENTS.KNOWLEDGE_VALIDATION_FAILED, { entity: 'blueprint', publicId, issues: validation.issues });
      throw KnowledgeErrors.validationFailed(validation.issues);
    }
    const exists = await this.prisma.questionBlueprint.findUnique({ where: { publicId }, select: { id: true } });
    if (exists) throw KnowledgeErrors.publicIdTaken(publicId);

    const bp = await this.prisma.questionBlueprint.create({
      data: {
        publicId, subjectCode: dto.subjectCode, topicCode: this.pad(dto.topicCode), subtopicCode: this.pad(dto.subtopicCode),
        blueprintType: dto.blueprintType, sequenceNumber: dto.sequenceNumber, name: dto.name, description: dto.description ?? null,
        primaryObjectiveId: dto.primaryObjectiveId ?? null, structure: dto.structure as unknown as Prisma.InputJsonValue,
        difficultyBand: dto.difficultyBand ?? null, sourceDocumentId: dto.sourceDocumentId ?? null,
        createdBy: user.id, status: 'draft', currentVersion: 1, semver: '1.0.0',
      },
    });
    await this.invalidate();
    this.eventEmitter.emit(EVENTS.KNOWLEDGE_BLUEPRINT_CREATED, { id: bp.id, publicId, actorId: user.id, timestamp: new Date().toISOString() });
    this.logger.log({ message: 'Blueprint created', publicId });
    return this.toView(bp);
  }

  async findById(id: string) {
    const bp = await this.prisma.questionBlueprint.findFirst({ where: { id, deletedAt: null } });
    if (!bp) throw KnowledgeErrors.entityNotFound('Blueprint', id);
    return this.toView(bp);
  }

  async publish(id: string, _user: AuthenticatedUser) {
    const bp = await this.prisma.questionBlueprint.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
    if (!bp) throw KnowledgeErrors.entityNotFound('Blueprint', id);
    if (bp.status !== 'approved') throw KnowledgeErrors.notPublishable(bp.status);
    const updated = await this.prisma.questionBlueprint.update({ where: { id }, data: { status: 'published' } });
    await this.invalidate();
    return this.toView(updated);
  }

  async setStatus(id: string, status: string, allowedFrom: string[]) {
    const bp = await this.prisma.questionBlueprint.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
    if (!bp) throw KnowledgeErrors.entityNotFound('Blueprint', id);
    if (!allowedFrom.includes(bp.status)) throw KnowledgeErrors.notPublishable(bp.status);
    const updated = await this.prisma.questionBlueprint.update({ where: { id }, data: { status: status as never } });
    await this.invalidate();
    return this.toView(updated);
  }

  async search(dto: BlueprintSearchDto) {
    const where: Prisma.QuestionBlueprintWhereInput = {
      deletedAt: null,
      ...(dto.subjectCode && { subjectCode: dto.subjectCode }),
      ...(dto.blueprintType && { blueprintType: dto.blueprintType }),
      ...(dto.status && { status: dto.status as never }),
      ...(dto.q && { OR: [{ name: { contains: dto.q, mode: 'insensitive' } }, { publicId: { contains: dto.q.toUpperCase() } }] }),
      ...(dto.cursor && { id: { gt: dto.cursor } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.questionBlueprint.findMany({ where, orderBy: { id: 'asc' }, take: dto.limit + 1 }),
      this.prisma.questionBlueprint.count({ where }),
    ]);
    const hasMore = rows.length > dto.limit;
    const page = hasMore ? rows.slice(0, dto.limit) : rows;
    return {
      data: page.map((bp: (typeof page)[number]) => this.toView(bp)),
      pagination: { cursor: hasMore && page.length ? page[page.length - 1]!.id : null, hasMore, total },
    };
  }

  private pad(n: number): string { return String(n).padStart(3, '0'); }
  private async invalidate() { await this.cache.invalidatePattern(`${KNOWLEDGE_CACHE_PREFIX}*`); }

  private toView(bp: {
    id: string; publicId: string; subjectCode: string; topicCode: string; subtopicCode: string;
    blueprintType: string; sequenceNumber: number; name: string; description: string | null;
    primaryObjectiveId: string | null; structure: unknown; difficultyBand: string | null;
    status: string; currentVersion: number; semver: string; createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: bp.id, publicId: bp.publicId, subjectCode: bp.subjectCode, topicCode: bp.topicCode, subtopicCode: bp.subtopicCode,
      blueprintType: bp.blueprintType, sequenceNumber: bp.sequenceNumber, name: bp.name, description: bp.description,
      primaryObjectiveId: bp.primaryObjectiveId, structure: bp.structure, difficultyBand: bp.difficultyBand,
      status: bp.status, currentVersion: bp.currentVersion, semver: bp.semver,
      createdAt: bp.createdAt.toISOString(), updatedAt: bp.updatedAt.toISOString(),
    };
  }
}
