import { describe, it, expect, beforeEach } from 'vitest';
import { PromptBuilderService } from '../services/prompt-builder.service';
import type { GenerationContext } from '../types/ai.types';

const ctx: GenerationContext = {
  learningObjective: { id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'Compute normal stress.', bloomLevel: 'apply', subjectCode: 'STR' },
  blueprint: { id: 'bp-1', publicId: 'BP-STR-004-002-CMP-001', name: 'Axial stress', blueprintType: 'CMP', structure: {} },
  formulas: [{ id: 'f-1', name: 'Normal Stress Equation', expressionText: 'σ = P / A' }],
  misconceptions: [{ id: 'mc-1', publicId: 'MC-STR-003-002-FRM-001', title: 'Stress vs strain', category: 'FRM', description: 'x' }],
  subjectCode: 'STR', topicCode: '001', difficultyBand: 'moderate',
};

describe('PromptBuilderService', () => {
  let svc: PromptBuilderService;
  beforeEach(() => { svc = new PromptBuilderService(); });

  it('grounds the prompt in the LO, blueprint, formulas, and misconceptions', () => {
    const p = svc.buildQuestionPrompt(ctx, 'base');
    expect(p).toContain('LO-STR-001-003-001');
    expect(p).toContain('BP-STR-004-002-CMP-001');
    expect(p).toContain('Normal Stress Equation');
    expect(p).toContain('MC-STR-003-002-FRM-001');
    expect(p).toContain('DIFFICULTY BAND: moderate');
  });
  it('instructs that distractors must map to misconceptions', () => {
    const p = svc.buildQuestionPrompt(ctx, 'base');
    expect(p.toLowerCase()).toContain('distractor');
  });
  it('builds an explanation prompt', () => {
    const p = svc.buildExplanationPrompt('stem', 'correct', ctx);
    expect(p).toContain('STEM: stem');
    expect(p).toContain('Normal Stress Equation');
  });
});
