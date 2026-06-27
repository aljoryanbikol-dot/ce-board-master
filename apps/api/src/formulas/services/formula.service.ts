/**
 * @file formula.service.ts
 * @module Formulas/Services
 *
 * FormulaService — manages the Formula Library (Book 4). Deliberately REUSES the
 * existing FormulaLibrary model (Module 5) rather than duplicating it; this
 * service adds the Sprint 2.8 concerns on top: governing [Subject]-F-####
 * identifier validation, slug generation, and knowledge-base search/CRUD.
 *
 * A formula's stable identifier is its unique slug (and unique name). When a
 * caller supplies a governing Formula ID, it is validated against the spec and
 * stored on the formula's `variables` JSON envelope under `_formulaId` so the
 * existing schema is reused without alteration.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { ValidationEngineService } from '../../knowledge/services/validation-engine.service';
import { KnowledgeErrors } from '../../knowledge/knowledge.errors';
import { KNOWLEDGE_CACHE_PREFIX } from '../../knowledge/constants/knowledge.constants';
import type { CreateFormulaDto, UpdateFormulaDto, FormulaSearchDto } from '../dto/formula.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class FormulaService {
  private readonly logger = new Logger(FormulaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly validator: ValidationEngineService,
  ) {}

  async create(dto: CreateFormulaDto, _user: AuthenticatedUser) {
    if (dto.formulaId) {
      const validation = this.validator.validateFormulaId(dto.formulaId);
      if (!validation.valid) throw KnowledgeErrors.validationFailed(validation.issues);
    }
    const slug = this.slugify(dto.name);
    const existing = await this.prisma.formulaLibrary.findFirst({ where: { OR: [{ slug }, { name: dto.name }] }, select: { id: true } });
    if (existing) throw KnowledgeErrors.publicIdTaken(dto.name);

    const variablesEnvelope = this.withFormulaId(dto.variables, dto.formulaId);
    const formula = await this.prisma.formulaLibrary.create({
      data: {
        name: dto.name, slug, subjectId: dto.subjectId, topicId: dto.topicId ?? null,
        expressionText: dto.expressionText, expressionLatex: dto.expressionLatex,
        variables: variablesEnvelope as unknown as Prisma.InputJsonValue, unitsSystem: dto.unitsSystem,
        imperialExpression: dto.imperialExpression ?? null, derivation: dto.derivation ?? null,
        assumptions: dto.assumptions, limitations: dto.limitations ?? null,
        typicalApplications: dto.typicalApplications, exampleProblem: dto.exampleProblem ?? null,
      },
    });
    await this.invalidate();
    this.logger.log({ message: 'Formula created', name: dto.name, formulaId: dto.formulaId ?? null });
    return this.toView(formula);
  }

  async findById(id: string) {
    const f = await this.prisma.formulaLibrary.findUnique({ where: { id } });
    if (!f) throw KnowledgeErrors.entityNotFound('Formula', id);
    return this.toView(f);
  }

  async update(id: string, dto: UpdateFormulaDto, _user: AuthenticatedUser) {
    const existing = await this.prisma.formulaLibrary.findUnique({ where: { id } });
    if (!existing) throw KnowledgeErrors.entityNotFound('Formula', id);
    const updated = await this.prisma.formulaLibrary.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name, slug: this.slugify(dto.name) }),
        ...(dto.expressionText !== undefined && { expressionText: dto.expressionText }),
        ...(dto.expressionLatex !== undefined && { expressionLatex: dto.expressionLatex }),
        ...(dto.variables !== undefined && { variables: dto.variables as unknown as Prisma.InputJsonValue }),
        ...(dto.assumptions !== undefined && { assumptions: dto.assumptions }),
        ...(dto.typicalApplications !== undefined && { typicalApplications: dto.typicalApplications }),
      },
    });
    await this.invalidate();
    return this.toView(updated);
  }

  async deactivate(id: string) {
    const existing = await this.prisma.formulaLibrary.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw KnowledgeErrors.entityNotFound('Formula', id);
    await this.prisma.formulaLibrary.update({ where: { id }, data: { isActive: false } });
    await this.invalidate();
  }

  async search(dto: FormulaSearchDto) {
    const where: Prisma.FormulaLibraryWhereInput = {
      isActive: true,
      ...(dto.subjectId && { subjectId: dto.subjectId }),
      ...(dto.q && { OR: [{ name: { contains: dto.q, mode: 'insensitive' } }, { expressionText: { contains: dto.q, mode: 'insensitive' } }] }),
      ...(dto.cursor && { id: { gt: dto.cursor } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.formulaLibrary.findMany({ where, orderBy: { id: 'asc' }, take: dto.limit + 1 }),
      this.prisma.formulaLibrary.count({ where }),
    ]);
    const hasMore = rows.length > dto.limit;
    const page = hasMore ? rows.slice(0, dto.limit) : rows;
    return {
      data: page.map((f: (typeof page)[number]) => this.toView(f)),
      pagination: { cursor: hasMore && page.length ? page[page.length - 1]!.id : null, hasMore, total },
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
  }

  private withFormulaId(variables: unknown[], formulaId?: string): unknown {
    return formulaId ? { _formulaId: formulaId, items: variables } : { items: variables };
  }

  private extractFormulaId(variables: unknown): string | null {
    if (variables && typeof variables === 'object' && '_formulaId' in variables) {
      return (variables as { _formulaId?: string })._formulaId ?? null;
    }
    return null;
  }

  private async invalidate() { await this.cache.invalidatePattern(`${KNOWLEDGE_CACHE_PREFIX}*`); }

  private toView(f: {
    id: string; name: string; slug: string; subjectId: string; topicId: string | null;
    expressionText: string; expressionLatex: string; variables: unknown; unitsSystem: string;
    assumptions: string[]; typicalApplications: string[]; isActive: boolean; createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: f.id, formulaId: this.extractFormulaId(f.variables), name: f.name, slug: f.slug,
      subjectId: f.subjectId, topicId: f.topicId, expressionText: f.expressionText, expressionLatex: f.expressionLatex,
      variables: f.variables, unitsSystem: f.unitsSystem, assumptions: f.assumptions,
      typicalApplications: f.typicalApplications, isActive: f.isActive,
      createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString(),
    };
  }
}
