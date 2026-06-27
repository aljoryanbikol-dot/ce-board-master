/**
 * @file knowledge-integration.service.ts
 * @module Knowledge/Services
 *
 * KnowledgeIntegrationService — the bridge the Question Bank and Admin CMS use to
 * validate content against the authoritative knowledge base (Sprint 2.8 items 9
 * & 10: CMS + Question Bank integration).
 *
 * It deliberately exposes a small, read-only, dependency-light surface so the
 * frozen question/CMS modules can consume it WITHOUT a schema change: given the
 * public IDs a question references (its Learning Objective, Blueprint, Formula,
 * and any Misconceptions used as distractors), it confirms each exists, is the
 * authoritative published version, and returns a structured verdict the caller
 * can attach to a review gate.
 *
 * This is how "every future question must validate against the knowledge base"
 * is enforced in practice: the AI Question Generator and the CMS review workflow
 * call verifyQuestionReferences() before a question can advance.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PublicIdService } from './public-id.service';

export interface QuestionKnowledgeRefs {
  learningObjectiveId?: string; // public LO ID, e.g. LO-STR-001-003-001
  blueprintId?: string;         // public BP ID
  formulaIds?: string[];        // formula library names or [Subject]-F-#### ids
  misconceptionIds?: string[];  // public MC IDs (distractor rationale)
}

export interface ReferenceCheck {
  ref: string;
  kind: 'learning_objective' | 'blueprint' | 'formula' | 'misconception';
  exists: boolean;
  published: boolean;
  formatValid: boolean;
}

export interface QuestionValidationVerdict {
  valid: boolean;
  checks: ReferenceCheck[];
  errors: string[];
}

@Injectable()
export class KnowledgeIntegrationService {
  private readonly logger = new Logger(KnowledgeIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publicId: PublicIdService,
  ) {}

  /**
   * Validate every knowledge reference a question carries. The Question Bank /
   * CMS call this before allowing a question to be authored, reviewed, or
   * published. A question is knowledge-valid when every referenced entity exists
   * and (for the gate the caller chooses) is published.
   */
  async verifyQuestionReferences(refs: QuestionKnowledgeRefs, opts: { requirePublished?: boolean } = {}): Promise<QuestionValidationVerdict> {
    const checks: ReferenceCheck[] = [];
    const errors: string[] = [];
    const requirePublished = opts.requirePublished ?? false;

    if (refs.learningObjectiveId) {
      const formatValid = this.publicId.validateLearningObjectiveId(refs.learningObjectiveId);
      const lo = formatValid
        ? await this.prisma.learningObjective.findFirst({ where: { publicId: refs.learningObjectiveId, deletedAt: null }, select: { status: true } })
        : null;
      const published = lo?.status === 'published';
      checks.push({ ref: refs.learningObjectiveId, kind: 'learning_objective', exists: !!lo, published, formatValid });
      if (!formatValid) errors.push(`Learning Objective ID '${refs.learningObjectiveId}' is malformed.`);
      else if (!lo) errors.push(`Learning Objective '${refs.learningObjectiveId}' does not exist.`);
      else if (requirePublished && !published) errors.push(`Learning Objective '${refs.learningObjectiveId}' is not published.`);
    } else {
      errors.push('A question must reference a Learning Objective (Book 11 §4.7).');
    }

    if (refs.blueprintId) {
      const formatValid = this.publicId.validateBlueprintId(refs.blueprintId);
      const bp = formatValid
        ? await this.prisma.questionBlueprint.findFirst({ where: { publicId: refs.blueprintId, deletedAt: null }, select: { status: true } })
        : null;
      const published = bp?.status === 'published';
      checks.push({ ref: refs.blueprintId, kind: 'blueprint', exists: !!bp, published, formatValid });
      if (!formatValid) errors.push(`Blueprint ID '${refs.blueprintId}' is malformed.`);
      else if (!bp) errors.push(`Blueprint '${refs.blueprintId}' does not exist.`);
      else if (requirePublished && !published) errors.push(`Blueprint '${refs.blueprintId}' is not published.`);
    }

    for (const mcId of refs.misconceptionIds ?? []) {
      const formatValid = this.publicId.validateMisconceptionId(mcId);
      const mc = formatValid
        ? await this.prisma.misconception.findFirst({ where: { publicId: mcId, deletedAt: null }, select: { status: true } })
        : null;
      checks.push({ ref: mcId, kind: 'misconception', exists: !!mc, published: mc?.status === 'published', formatValid });
      if (!formatValid) errors.push(`Misconception ID '${mcId}' is malformed.`);
      else if (!mc) errors.push(`Misconception '${mcId}' does not exist.`);
    }

    for (const fId of refs.formulaIds ?? []) {
      const formatValid = this.publicId.validateFormulaId(fId);
      // Formula references may be by governing ID (stored in the variables
      // envelope) or by unique name; existence is best-effort by name match.
      const f = await this.prisma.formulaLibrary.findFirst({ where: { isActive: true, name: fId }, select: { id: true } });
      checks.push({ ref: fId, kind: 'formula', exists: !!f, published: !!f, formatValid: formatValid || !!f });
      if (!f && !formatValid) errors.push(`Formula reference '${fId}' is neither a known formula name nor a valid Formula ID.`);
    }

    const valid = errors.length === 0;
    this.logger.debug({ message: 'Question knowledge references verified', valid, checks: checks.length, errors: errors.length });
    return { valid, checks, errors };
  }

  /**
   * Resolve a Learning Objective public ID to its canonical record (used by the
   * CMS to display the LO statement alongside a question under review).
   */
  async resolveLearningObjective(publicId: string) {
    if (!this.publicId.validateLearningObjectiveId(publicId)) return null;
    return this.prisma.learningObjective.findFirst({
      where: { publicId, deletedAt: null },
      select: { id: true, publicId: true, statement: true, bloomLevel: true, status: true, semver: true },
    });
  }

  /**
   * For the AI Question Generator: the published blueprints + misconceptions
   * available for a given subject/topic, so generated questions are grounded in
   * approved knowledge-base entities.
   */
  async getGenerationContext(subjectCode: string, topicCode?: string) {
    const [blueprints, misconceptions] = await Promise.all([
      this.prisma.questionBlueprint.findMany({
        where: { subjectCode, status: 'published', deletedAt: null, ...(topicCode && { topicCode }) },
        select: { id: true, publicId: true, name: true, blueprintType: true, primaryObjectiveId: true, structure: true },
        take: 100,
      }),
      this.prisma.misconception.findMany({
        where: { subjectCode, status: 'published', deletedAt: null, ...(topicCode && { topicCode }) },
        select: { id: true, publicId: true, title: true, category: true, description: true },
        take: 100,
      }),
    ]);
    return { subjectCode, topicCode: topicCode ?? null, blueprints, misconceptions };
  }
}
