/**
 * @file validation.service.ts
 * @module AI/Services
 *
 * ValidationService — the validation pipeline every generated question MUST pass
 * before it can be promoted to the CMS. It runs ordered, independent stages:
 *
 *   1. structure        — well-formed MCQ (stem, ≥3 choices, exactly one correct)
 *   2. knowledge_base   — references a published LO/Blueprint (via KnowledgeIntegrationService)
 *   3. formula_library  — any cited formula exists and is active
 *   4. misconceptions   — every distractor maps to a real, published misconception
 *   5. editorial        — editorial standards (length, no placeholders, single answer)
 *   6. duplicate        — content hash not already present (duplicate detection)
 *
 * Each stage contributes issues; an `error` fails the pipeline, a `warning`
 * downgrades to passed_with_warnings. Pure orchestration over injected KB
 * services + Prisma reads; no writes.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KnowledgeIntegrationService } from '../../knowledge/services/knowledge-integration.service';
import { AI_LIMITS } from '../constants/ai.constants';
import type { GeneratedQuestionDraft, PipelineValidationReport, ValidationIssue } from '../types/ai.types';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeIntegrationService,
  ) {}

  async validate(draft: GeneratedQuestionDraft, opts: { requirePublished?: boolean } = {}): Promise<PipelineValidationReport> {
    const issues: ValidationIssue[] = [];
    const stages: PipelineValidationReport['stages'] = [];

    const run = async (stage: string, fn: () => Promise<ValidationIssue[]> | ValidationIssue[]) => {
      const stageIssues = await fn();
      issues.push(...stageIssues);
      stages.push({ stage, passed: !stageIssues.some((i) => i.severity === 'error'), issueCount: stageIssues.length });
    };

    await run('structure', () => this.checkStructure(draft));
    await run('knowledge_base', () => this.checkKnowledgeBase(draft, opts.requirePublished ?? true));
    await run('formula_library', () => this.checkFormulas(draft));
    await run('misconceptions', () => this.checkMisconceptions(draft));
    await run('editorial', () => this.checkEditorial(draft));
    await run('duplicate', () => this.checkDuplicate(draft));

    const hasError = issues.some((i) => i.severity === 'error');
    const hasWarning = issues.some((i) => i.severity === 'warning');
    const outcome: PipelineValidationReport['outcome'] = hasError ? 'failed' : hasWarning ? 'passed_with_warnings' : 'passed';
    this.logger.log({ message: 'Validation pipeline complete', outcome, issues: issues.length });
    return { outcome, issues, stages };
  }

  // ── Stages ──────────────────────────────────────────────────────────────────

  private checkStructure(draft: GeneratedQuestionDraft): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!draft.stemText || draft.stemText.trim().length < 10) issues.push(this.err('structure', 'stem', 'Stem is missing or too short.'));
    if (draft.choices.length < AI_LIMITS.MIN_DISTRACTORS) issues.push(this.err('structure', 'choices', `A question needs at least ${AI_LIMITS.MIN_DISTRACTORS} choices.`));
    const correct = draft.choices.filter((c) => c.isCorrect);
    if (correct.length !== 1) issues.push(this.err('structure', 'correctChoice', `Exactly one correct choice is required (found ${correct.length}).`));
    if (correct[0] && correct[0].letter !== draft.correctChoice) issues.push(this.err('structure', 'correctChoice', 'correctChoice letter does not match the flagged choice.'));
    const letters = new Set(draft.choices.map((c) => c.letter));
    if (letters.size !== draft.choices.length) issues.push(this.err('structure', 'choices', 'Choice letters must be unique.'));
    return issues;
  }

  private async checkKnowledgeBase(draft: GeneratedQuestionDraft, requirePublished: boolean): Promise<ValidationIssue[]> {
    const verdict = await this.knowledge.verifyQuestionReferences(
      {
        learningObjectiveId: draft.learningObjectiveId ?? undefined,
        blueprintId: draft.blueprintId ?? undefined,
        misconceptionIds: draft.misconceptionIds,
      },
      { requirePublished },
    );
    return verdict.errors.map((e) => this.err('knowledge_base', 'reference', e));
  }

  private async checkFormulas(draft: GeneratedQuestionDraft): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    for (const name of draft.formulaIds) {
      const f = await this.prisma.formulaLibrary.findFirst({ where: { isActive: true, name }, select: { id: true } });
      if (!f) issues.push(this.warn('formula_library', 'formula', `Cited formula '${name}' is not in the active Formula Library.`));
    }
    return issues;
  }

  private async checkMisconceptions(draft: GeneratedQuestionDraft): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const distractors = draft.choices.filter((c) => !c.isCorrect);
    const mapped = distractors.filter((c) => c.misconceptionId).length;
    if (mapped === 0 && distractors.length > 0) {
      issues.push(this.warn('misconceptions', 'distractors', 'No distractor maps to a catalogued misconception; quality is reduced.'));
    }
    for (const mcId of draft.misconceptionIds) {
      const mc = await this.prisma.misconception.findFirst({ where: { publicId: mcId, deletedAt: null }, select: { status: true } });
      if (!mc) issues.push(this.err('misconceptions', 'misconception', `Misconception '${mcId}' does not exist.`));
      else if (mc.status !== 'published') issues.push(this.warn('misconceptions', 'misconception', `Misconception '${mcId}' is not published.`));
    }
    return issues;
  }

  private checkEditorial(draft: GeneratedQuestionDraft): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!draft.explanationText || draft.explanationText.trim().length < 20) issues.push(this.err('editorial', 'explanation', 'Explanation is required and must be substantive (Book 8).'));
    if (draft.solutionSteps.length === 0) issues.push(this.warn('editorial', 'solutionSteps', 'No solution steps provided.'));
    const placeholder = /\b(TODO|TBD|lorem ipsum|xxx)\b/i;
    if (placeholder.test(draft.stemText) || placeholder.test(draft.explanationText)) issues.push(this.err('editorial', 'placeholder', 'Content contains placeholder text (Book 15).'));
    for (const c of draft.choices) {
      if (!c.text || c.text.trim().length < 2) issues.push(this.err('editorial', 'choice', `Choice ${c.letter} text is empty.`));
    }
    return issues;
  }

  private async checkDuplicate(draft: GeneratedQuestionDraft): Promise<ValidationIssue[]> {
    const existing = await this.prisma.aiGeneratedVariant.findFirst({ where: { contentHash: draft.contentHash, isDuplicate: false }, select: { id: true } });
    if (existing) return [this.err('duplicate', 'contentHash', 'An identical generated question already exists (duplicate detected).')];
    return [];
  }

  private err(stage: string, field: string, message: string): ValidationIssue {
    return { code: 'VALIDATION_ERROR', stage, message: `[${field}] ${message}`, severity: 'error' };
  }
  private warn(stage: string, field: string, message: string): ValidationIssue {
    return { code: 'VALIDATION_WARNING', stage, message: `[${field}] ${message}`, severity: 'warning' };
  }
}
