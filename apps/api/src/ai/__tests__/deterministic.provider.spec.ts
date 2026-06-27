/**
 * @file deterministic.provider.spec.ts
 * @module AI/Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DeterministicGenerationProvider } from '../providers/deterministic.provider';
import type { GenerationContext } from '../types/ai.types';

const context = (): GenerationContext => ({
  learningObjective: { id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'Compute the normal stress in an axially loaded member.', bloomLevel: 'apply', subjectCode: 'STR' },
  blueprint: null,
  formulas: [{ id: 'f-1', name: 'Normal Stress Equation', expressionText: 'σ = P / A' }],
  misconceptions: [
    { id: 'mc-1', publicId: 'MC-STR-003-002-FRM-001', title: 'Stress vs strain confusion', category: 'FRM', description: 'Applies stress formula for strain.' },
    { id: 'mc-2', publicId: 'MC-STR-003-002-UNT-001', title: 'Unit error', category: 'UNT', description: 'Mixes MPa and Pa.' },
  ],
  subjectCode: 'STR', topicCode: '001', difficultyBand: 'moderate',
});

describe('DeterministicGenerationProvider', () => {
  let provider: DeterministicGenerationProvider;
  beforeEach(() => { provider = new DeterministicGenerationProvider(); });

  it('produces a well-formed MCQ draft grounded in the LO', async () => {
    const draft = await provider.generateQuestion({ context: context(), variantType: 'base', seed: 'seed-1' });
    expect(draft.stemText.length).toBeGreaterThan(10);
    expect(draft.choices.length).toBeGreaterThanOrEqual(3);
    expect(draft.choices.filter((c) => c.isCorrect)).toHaveLength(1);
    expect(draft.learningObjectiveId).toBe('LO-STR-001-003-001');
    expect(draft.correctChoice).toBe(draft.choices.find((c) => c.isCorrect)!.letter);
  });

  it('is deterministic for a fixed seed', async () => {
    const a = await provider.generateQuestion({ context: context(), variantType: 'base', seed: 'fixed' });
    const b = await provider.generateQuestion({ context: context(), variantType: 'base', seed: 'fixed' });
    expect(a.contentHash).toBe(b.contentHash);
  });

  it('produces different content for different seeds', async () => {
    const a = await provider.generateQuestion({ context: context(), variantType: 'numerical', seed: 's1' });
    const b = await provider.generateQuestion({ context: context(), variantType: 'numerical', seed: 's2' });
    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it('derives distractors from the misconception library', async () => {
    const draft = await provider.generateQuestion({ context: context(), variantType: 'conceptual', seed: 'seed-2' });
    expect(draft.misconceptionIds.length).toBeGreaterThan(0);
    expect(draft.misconceptionIds.every((id) => id.startsWith('MC-'))).toBe(true);
  });

  it('numerical variants inject operands into the stem', async () => {
    const draft = await provider.generateQuestion({ context: context(), variantType: 'numerical', seed: 'num' });
    expect(draft.variantType).toBe('numerical');
    expect(draft.stemText).toMatch(/\d+/);
  });

  it('cites the authoritative formula in the explanation', async () => {
    const draft = await provider.generateQuestion({ context: context(), variantType: 'base', seed: 'seed-3' });
    expect(draft.explanationText).toContain('Normal Stress Equation');
    expect(draft.solutionSteps.length).toBeGreaterThan(0);
  });

  it('handles a context with no misconceptions (generic distractors)', async () => {
    const ctx = { ...context(), misconceptions: [] };
    const draft = await provider.generateQuestion({ context: ctx, variantType: 'base', seed: 'seed-4' });
    expect(draft.choices.length).toBeGreaterThanOrEqual(3);
    expect(draft.misconceptionIds).toHaveLength(0);
  });
});
