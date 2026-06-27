/**
 * @file deterministic-tutor.provider.spec.ts
 * @module AITutor/Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DeterministicTutorProvider } from '../providers/deterministic-tutor.provider';
import type { TutorContext } from '../types/tutor.types';

const ctx = (over: Partial<TutorContext> = {}): TutorContext => ({
  subjectId: 's-1', topicId: 't-1',
  learningObjectives: [{ publicId: 'LO-1', statement: 'Understand equilibrium' }],
  formulas: [{ id: 'f-1', name: "Ohm's Law", expression: 'V=IR' }],
  misconceptions: [{ publicId: 'MIS-1', title: 'Sign Error', description: 'Students flip signs.' }],
  memorySummary: null, recentTurns: [], ...over,
});

describe('DeterministicTutorProvider', () => {
  let p: DeterministicTutorProvider;
  beforeEach(() => { p = new DeterministicTutorProvider(); });

  it('has a stable name (provider seam identity)', () => {
    expect(p.name).toBe('deterministic-tutor-v1');
  });

  it('grounds a free-form answer in the LO statement', async () => {
    const out = await p.respond({ intent: 'ask_question', prompt: 'What is equilibrium?', context: ctx() });
    expect(out.content).toContain('equilibrium');
    expect(out.tokensOut).toBeGreaterThan(0);
  });

  it('produces escalating hints that never reveal the answer', async () => {
    const nudge = await p.respond({ intent: 'hint', prompt: 'q', context: ctx(), hintLevel: 1 });
    const near = await p.respond({ intent: 'hint', prompt: 'q', context: ctx(), hintLevel: 3 });
    expect(nudge.content.toLowerCase()).toContain('nudge');
    expect(near.content.toLowerCase()).toContain('nearly');
    expect(near.content).not.toMatch(/the answer is/i);
  });

  it('explains a question using its correct choice + explanation', async () => {
    const out = await p.respond({ intent: 'explain_question', prompt: 'stem', context: ctx(), questionContext: { stemText: 'A beam is loaded...', correctChoice: 'C', explanationText: 'Because the moment balances.' } });
    expect(out.content).toContain('C');
  });

  it('returns formula text for formula_help', async () => {
    const out = await p.respond({ intent: 'formula_help', prompt: 'ohm', context: ctx() });
    expect(out.content).toContain("Ohm's Law");
  });

  it('solves with ordered steps ending in the correct choice', async () => {
    const out = await p.solve({ stemText: 'Find the current.', correctChoice: 'B', explanationText: 'Apply V=IR.', context: ctx() });
    expect(out.steps.length).toBeGreaterThanOrEqual(3);
    expect(out.finalAnswer).toBe('Choice B');
    expect(out.steps[out.steps.length - 1]).toContain('B');
  });

  it('offers follow-up questions grounded in context', async () => {
    const out = await p.respond({ intent: 'explain_concept', prompt: 'equilibrium', context: ctx() });
    expect(out.followUps.length).toBeGreaterThan(0);
  });
});
