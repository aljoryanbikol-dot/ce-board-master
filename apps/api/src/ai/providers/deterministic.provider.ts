/**
 * @file deterministic.provider.ts
 * @module AI/Providers
 *
 * DeterministicGenerationProvider — the default, dependency-free generation
 * provider. It does NOT call an external LLM; instead it composes a question
 * draft deterministically from the grounded Knowledge Base context (Learning
 * Objective statement, blueprint structure, formulas, and misconceptions), using
 * a seeded PRNG so output is reproducible and testable.
 *
 * This proves the full pipeline end-to-end and is the safe production default;
 * an LLM-backed provider can replace it behind the GenerationProvider contract
 * without touching the pipeline. Distractors are intentionally derived from the
 * misconception library so every wrong answer maps to a real, catalogued error.
 */
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { GenerationProvider } from './generation-provider.interface';
import type { GeneratedQuestionDraft, GeneratedChoice, ProviderGenerateInput } from '../types/ai.types';
import { AI_PROVIDERS, CHOICE_LETTERS, DIFFICULTY_SCALE, AI_LIMITS } from '../constants/ai.constants';

@Injectable()
export class DeterministicGenerationProvider implements GenerationProvider {
  readonly name = AI_PROVIDERS.DETERMINISTIC;
  private readonly logger = new Logger(DeterministicGenerationProvider.name);

  async generateQuestion(input: ProviderGenerateInput): Promise<GeneratedQuestionDraft> {
    const { context, variantType, seed } = input;
    const rng = this.seededRng(seed);

    const lo = context.learningObjective;
    const topic = lo?.statement ?? context.blueprint?.name ?? 'the target concept';
    const difficultyFactor = DIFFICULTY_SCALE[context.difficultyBand];

    // Stem: numerical variants inject seeded operands; conceptual variants pose a "why".
    const stemText = this.buildStem(topic, variantType, rng, difficultyFactor);

    // Correct answer + misconception-derived distractors.
    const choices = this.buildChoices(context, variantType, rng);
    const correct = choices.find((c) => c.isCorrect)!;

    const draft: GeneratedQuestionDraft = {
      stemText,
      choices,
      correctChoice: correct.letter,
      explanationText: this.buildExplanation(topic, context, correct),
      solutionSteps: this.buildSolutionSteps(context, variantType, difficultyFactor),
      bloomLevel: lo?.bloomLevel ?? 'apply',
      difficultyBand: context.difficultyBand,
      learningObjectiveId: lo?.publicId ?? null,
      blueprintId: context.blueprint?.publicId ?? null,
      formulaIds: context.formulas.map((f) => f.name),
      misconceptionIds: choices.filter((c) => c.misconceptionId).map((c) => c.misconceptionId!),
      estSolvingTimeSec: 60 + difficultyFactor * 30,
      variantType,
      contentHash: '',
    };
    draft.contentHash = this.hashDraft(draft);
    this.logger.debug({ message: 'Draft generated', variantType, lo: lo?.publicId, hash: draft.contentHash.slice(0, 8) });
    return draft;
  }

  async generateExplanation(draft: GeneratedQuestionDraft): Promise<{ explanationText: string; solutionSteps: string[] }> {
    return { explanationText: draft.explanationText, solutionSteps: draft.solutionSteps };
  }

  // ── Composition helpers ───────────────────────────────────────────────────────

  private buildStem(topic: string, variantType: string, rng: () => number, difficulty: number): string {
    if (variantType === 'numerical') {
      const a = Math.floor(rng() * 90 * difficulty) + 10;
      const b = Math.floor(rng() * 9 * difficulty) + 1;
      return `Given the relationship described by "${topic}", compute the resulting value when the primary parameter is ${a} and the secondary parameter is ${b}.`;
    }
    if (variantType === 'conceptual') {
      const angles = [
        'which statement best explains the underlying engineering principle',
        'which of the following correctly identifies the governing assumption',
        'which option most accurately describes the limiting condition',
        'which statement best distinguishes the correct application from a common error',
        'which response correctly relates the principle to design practice',
      ];
      const angle = angles[Math.floor(rng() * angles.length)]!;
      return `With respect to "${topic}", ${angle}?`;
    }
    return `Based on "${topic}", select the response that correctly applies the governing principle.`;
  }

  private buildChoices(context: ProviderGenerateInput['context'], variantType: string, rng: () => number): GeneratedChoice[] {
    const correctText = variantType === 'numerical'
      ? `The value follows directly from the governing equation${context.formulas[0] ? ` (${context.formulas[0].name})` : ''}.`
      : `It correctly applies the principle expressed by ${context.learningObjective?.publicId ?? 'the objective'}.`;

    const distractorPool = context.misconceptions.slice(0, AI_LIMITS.MAX_DISTRACTORS - 1);
    const distractorCount = Math.max(AI_LIMITS.MIN_DISTRACTORS - 1, Math.min(distractorPool.length, 3));

    const choices: GeneratedChoice[] = [{ letter: 'A', text: correctText, isCorrect: true, rationale: 'Correct application of the governing principle.' }];

    for (let i = 0; i < distractorCount; i++) {
      const mc = distractorPool[i % Math.max(distractorPool.length, 1)];
      const letter = CHOICE_LETTERS[i + 1]!;
      choices.push(mc
        ? { letter, text: `Reflects the error: ${mc.title}.`, isCorrect: false, rationale: `Encodes misconception ${mc.publicId} (${mc.category}).`, misconceptionId: mc.publicId }
        : { letter, text: `A plausible but incorrect application of the principle (variant ${letter}).`, isCorrect: false, rationale: 'Generic distractor — no catalogued misconception available.' });
    }

    // Deterministic shuffle so the correct answer is not always 'A'.
    return this.shuffleLetters(choices, rng);
  }

  private buildExplanation(topic: string, context: ProviderGenerateInput['context'], correct: GeneratedChoice): string {
    const formula = context.formulas[0] ? ` The relevant formula is ${context.formulas[0].name}: ${context.formulas[0].expressionText}.` : '';
    return `The correct answer (${correct.letter}) applies the principle described by "${topic}".${formula} Each distractor corresponds to a documented misconception, so a learner selecting it reveals a specific, addressable error.`;
  }

  private buildSolutionSteps(context: ProviderGenerateInput['context'], variantType: string, difficulty: number): string[] {
    const steps = [
      `Identify the governing principle from ${context.learningObjective?.publicId ?? 'the learning objective'}.`,
    ];
    if (context.formulas[0]) steps.push(`Apply the formula ${context.formulas[0].name} (${context.formulas[0].expressionText}).`);
    if (variantType === 'numerical') {
      steps.push('Substitute the given parameters into the equation.');
      steps.push('Carry units through the computation and simplify.');
      if (difficulty >= 4) steps.push('Check the result against expected engineering bounds.');
    } else {
      steps.push('Relate the principle to the scenario described in the stem.');
      steps.push('Eliminate options that match catalogued misconceptions.');
    }
    steps.push('Confirm the selected answer is internally consistent.');
    return steps.slice(0, AI_LIMITS.MAX_SOLUTION_STEPS);
  }

  private shuffleLetters(choices: GeneratedChoice[], rng: () => number): GeneratedChoice[] {
    const texts = choices.map((c) => ({ text: c.text, isCorrect: c.isCorrect, rationale: c.rationale, misconceptionId: c.misconceptionId }));
    for (let i = texts.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [texts[i], texts[j]] = [texts[j]!, texts[i]!];
    }
    return texts.map((t, idx) => ({ letter: CHOICE_LETTERS[idx]!, text: t.text, isCorrect: t.isCorrect, rationale: t.rationale, misconceptionId: t.misconceptionId }));
  }

  private seededRng(seed: string): () => number {
    // Mulberry32 seeded from the sha256 of the seed string — deterministic.
    let h = parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16) >>> 0;
    return () => {
      h |= 0; h = (h + 0x6d2b79f5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private hashDraft(draft: GeneratedQuestionDraft): string {
    const normalized = `${draft.stemText}::${draft.choices.map((c) => c.text).sort().join('|')}`.toLowerCase().replace(/\s+/g, ' ').trim();
    return createHash('sha256').update(normalized).digest('hex');
  }
}
