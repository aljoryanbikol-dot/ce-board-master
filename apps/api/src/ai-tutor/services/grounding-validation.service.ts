/**
 * @file grounding-validation.service.ts
 * @module AITutor/Services
 *
 * GroundingValidationService — a lightweight check that a tutor answer is
 * actually grounded in the assembled Knowledge Base context. It does not call an
 * LLM; it verifies that the answer references at least one context item (LO,
 * formula, or misconception) when such items exist, and flags ungrounded output.
 * This is the cheap guardrail that keeps the deterministic and (future) LLM
 * providers honest. Pure (no persistence).
 */
import { Injectable } from '@nestjs/common';
import type { TutorContext } from '../types/tutor.types';

@Injectable()
export class GroundingValidationService {
  validate(content: string, ctx: TutorContext): { ok: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const hasKb = ctx.learningObjectives.length > 0 || ctx.formulas.length > 0 || ctx.misconceptions.length > 0;

    if (!content || content.trim().length === 0) {
      return { ok: false, reasons: ['empty_content'] };
    }
    if (!hasKb) {
      // No KB material to ground against; allowed but marked as ungrounded.
      return { ok: true, reasons: ['no_kb_context'] };
    }

    const lower = content.toLowerCase();
    const referencesLo = ctx.learningObjectives.some((l) => lower.includes(l.publicId.toLowerCase()) || this.overlaps(lower, l.statement));
    const referencesFormula = ctx.formulas.some((f) => lower.includes(f.name.toLowerCase()) || lower.includes(f.expression.toLowerCase()));
    const referencesMisconception = ctx.misconceptions.some((m) => lower.includes(m.title.toLowerCase()));

    if (!referencesLo && !referencesFormula && !referencesMisconception) {
      reasons.push('no_context_reference');
      return { ok: false, reasons };
    }
    return { ok: true, reasons };
  }

  /** Crude lexical overlap: does the answer share a salient phrase with the statement? */
  private overlaps(lowerContent: string, statement: string): boolean {
    const words = statement.toLowerCase().split(/\W+/).filter((w) => w.length > 5);
    const hits = words.filter((w) => lowerContent.includes(w)).length;
    return hits >= Math.min(2, words.length);
  }
}
