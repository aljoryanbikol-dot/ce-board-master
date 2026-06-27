/**
 * @file deterministic-tutor.provider.ts
 * @module AITutor/Providers
 *
 * DeterministicTutorProvider — the default, dependency-free tutor backend. It
 * composes grounded answers from the assembled Knowledge Base context (learning
 * objectives, formulas, misconceptions) and the question itself. It is
 * intentionally transparent and reproducible: no external LLM call. The output
 * shape matches what an LLM-backed provider would return, so the swap is purely
 * a binding change.
 *
 * The determinism keeps the tutor honest in this phase: every assertion it makes
 * is traceable to a context item, which is exactly what the grounding/validation
 * layer checks.
 */
import { Injectable } from '@nestjs/common';
import { HINT_LEVELS, TUTOR_PERSONA } from '../constants/tutor.constants';
import type { TutorProvider, TutorProviderInput, TutorProviderOutput } from './tutor-provider.interface';
import type { TutorContext } from '../types/tutor.types';

@Injectable()
export class DeterministicTutorProvider implements TutorProvider {
  readonly name = 'deterministic-tutor-v1';

  async respond(input: TutorProviderInput): Promise<TutorProviderOutput> {
    const parts: string[] = [];

    switch (input.intent) {
      case 'hint':
        parts.push(this.hintText(input.hintLevel ?? HINT_LEVELS.NUDGE, input.context, input.questionContext));
        break;
      case 'explain_question':
        parts.push(this.explainQuestion(input.questionContext, input.context));
        break;
      case 'explain_concept':
        parts.push(this.explainConcept(input.prompt, input.context));
        break;
      case 'formula_help':
        parts.push(this.formulaText(input.context));
        break;
      case 'coaching':
        parts.push(this.coachingText(input.prompt, input.context));
        break;
      default:
        parts.push(this.answerText(input.prompt, input.context));
    }

    const content = parts.join('\n\n').trim();
    return { content, followUps: this.followUps(input.intent, input.context), tokensIn: this.estimate(input.prompt), tokensOut: this.estimate(content) };
  }

  async solve(input: { stemText: string; correctChoice: string; explanationText: string | null; context: TutorContext }) {
    const steps: string[] = [];
    steps.push(`Identify what the problem asks: ${this.firstSentence(input.stemText)}`);
    if (input.context.formulas.length) {
      steps.push(`Recall the governing relationship: ${input.context.formulas[0]!.name} — ${input.context.formulas[0]!.expression}.`);
      steps.push('Substitute the known quantities into the formula, keeping units consistent.');
    } else {
      steps.push('Set up the governing relationship from first principles and list known/unknown quantities.');
    }
    steps.push('Solve algebraically for the unknown, then check the result against the expected order of magnitude.');
    if (input.explanationText) steps.push(`Reasoning from the reference solution: ${this.firstSentence(input.explanationText)}`);
    steps.push(`Therefore the correct choice is ${input.correctChoice}.`);
    const finalAnswer = `Choice ${input.correctChoice}`;
    return { steps, finalAnswer, tokensIn: this.estimate(input.stemText), tokensOut: this.estimate(steps.join(' ')) };
  }

  // ── text composers (grounded) ───────────────────────────────────────────────
  private answerText(prompt: string, ctx: TutorContext): string {
    const lo = ctx.learningObjectives[0];
    const base = lo ? `Grounded in learning objective ${lo.publicId}: ${lo.statement}` : 'Here is a grounded explanation based on the CE board knowledge base.';
    return `${base}\n\nIn response to "${this.firstSentence(prompt)}": ${this.synthesize(ctx)}`;
  }

  private explainConcept(_prompt: string, ctx: TutorContext): string {
    const los = ctx.learningObjectives.slice(0, 2).map((l) => `• ${l.statement} (${l.publicId})`).join('\n');
    return `Concept explanation${los ? `, grounded in:\n${los}` : ''}\n\n${this.synthesize(ctx)}`;
  }

  private explainQuestion(q: TutorProviderInput['questionContext'], ctx: TutorContext): string {
    if (!q) return this.synthesize(ctx);
    const expl = q.explanationText ? this.firstSentence(q.explanationText) : 'Work from the governing principles for this topic.';
    return `This question tests: ${this.firstSentence(q.stemText)}\n\nThe correct choice is ${q.correctChoice}. ${expl}`;
  }

  private hintText(level: number, ctx: TutorContext, _q: TutorProviderInput['questionContext']): string {
    if (level >= HINT_LEVELS.NEAR_ANSWER) {
      const f = ctx.formulas[0];
      return f ? `Nearly there: apply ${f.name} (${f.expression}) with the given values and solve for the unknown.` : 'Nearly there: set up the governing equation and isolate the unknown — you have all the quantities you need.';
    }
    if (level === HINT_LEVELS.DIRECTION) {
      const f = ctx.formulas[0];
      return f ? `Direction: this is a ${f.name} problem. Start from ${f.expression}.` : 'Direction: identify which principle governs this scenario, then write its defining equation.';
    }
    const lo = ctx.learningObjectives[0];
    return lo ? `Nudge: recall ${lo.statement}` : 'Nudge: re-read the question and note which quantities are given vs. asked.';
  }

  private formulaText(ctx: TutorContext): string {
    if (!ctx.formulas.length) return 'No matching formula found in the knowledge base for this topic.';
    return ctx.formulas.slice(0, 3).map((f) => `${f.name}: ${f.expression}`).join('\n');
  }

  private coachingText(prompt: string, ctx: TutorContext): string {
    return `Coaching focus: ${this.firstSentence(prompt)}\n\n${this.synthesize(ctx)}\n\nPractice a few targeted questions on this topic, then re-test.`;
  }

  private synthesize(ctx: TutorContext): string {
    const bits: string[] = [];
    if (ctx.learningObjectives[0]) bits.push(ctx.learningObjectives[0].statement);
    if (ctx.formulas[0]) bits.push(`Key relationship: ${ctx.formulas[0].name} (${ctx.formulas[0].expression}).`);
    if (ctx.misconceptions[0]) bits.push(`Watch out for: ${ctx.misconceptions[0].title} — ${this.firstSentence(ctx.misconceptions[0].description)}`);
    return bits.length ? bits.join(' ') : `${TUTOR_PERSONA.name}: I could not find specific knowledge-base material; reason from first principles and verify with a reference.`;
  }

  private followUps(intent: string, ctx: TutorContext): string[] {
    const ups: string[] = [];
    if (ctx.formulas[0]) ups.push(`How is ${ctx.formulas[0].name} derived?`);
    if (intent !== 'step_solution') ups.push('Can you walk me through a step-by-step solution?');
    if (ctx.misconceptions[0]) ups.push(`What's the common mistake with ${ctx.misconceptions[0].title}?`);
    return ups.slice(0, 3);
  }

  private firstSentence(text: string): string {
    const s = text.trim().split(/(?<=[.?!])\s/)[0] ?? text;
    return s.length > 240 ? `${s.slice(0, 237)}...` : s;
  }

  private estimate(text: string): number {
    return Math.ceil((text?.length ?? 0) / 4);
  }
}
