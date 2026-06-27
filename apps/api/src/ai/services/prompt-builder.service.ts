/**
 * @file prompt-builder.service.ts
 * @module AI/Services
 *
 * PromptBuilderService — assembles the grounded prompt that drives generation.
 * Even with the deterministic provider, the assembled prompt is persisted as an
 * audit artifact (what knowledge grounded this generation). When an LLM provider
 * is slotted in, this is the exact text it receives — built ONLY from Knowledge
 * Base entities, never from free-form user input, enforcing "the KB is the only
 * authoritative source."
 */
import { Injectable } from '@nestjs/common';
import type { GenerationContext } from '../types/ai.types';

@Injectable()
export class PromptBuilderService {
  buildQuestionPrompt(context: GenerationContext, variantType: string): string {
    const lines: string[] = [];
    lines.push('You are an enterprise Civil Engineering board-exam item writer.');
    lines.push('Generate exactly one multiple-choice question grounded ONLY in the following approved Knowledge Base entities.');
    lines.push('');
    if (context.learningObjective) {
      lines.push(`LEARNING OBJECTIVE (${context.learningObjective.publicId}, Bloom: ${context.learningObjective.bloomLevel}):`);
      lines.push(context.learningObjective.statement);
      lines.push('');
    }
    if (context.blueprint) {
      lines.push(`BLUEPRINT (${context.blueprint.publicId}, type ${context.blueprint.blueprintType}): ${context.blueprint.name}`);
      lines.push('');
    }
    if (context.formulas.length) {
      lines.push('AUTHORITATIVE FORMULAS (use only these):');
      for (const f of context.formulas) lines.push(`- ${f.name}: ${f.expressionText}`);
      lines.push('');
    }
    if (context.misconceptions.length) {
      lines.push('MISCONCEPTIONS (each distractor MUST encode one of these documented errors):');
      for (const m of context.misconceptions) lines.push(`- ${m.publicId} [${m.category}] ${m.title}: ${m.description}`);
      lines.push('');
    }
    lines.push(`DIFFICULTY BAND: ${context.difficultyBand}`);
    lines.push(`VARIANT TYPE: ${variantType}`);
    lines.push('');
    lines.push('Rules: every distractor must map to a misconception above; the explanation must cite the governing principle; do not introduce facts not present in the Knowledge Base.');
    return lines.join('\n');
  }

  buildExplanationPrompt(stem: string, correctText: string, context: GenerationContext): string {
    return [
      'Write a concise, pedagogically sound explanation for the following board-exam question.',
      `STEM: ${stem}`,
      `CORRECT ANSWER: ${correctText}`,
      context.formulas[0] ? `FORMULA: ${context.formulas[0].name} — ${context.formulas[0].expressionText}` : '',
      'Explain why the answer is correct and reference the governing principle. Do not invent facts.',
    ].filter(Boolean).join('\n');
  }
}
