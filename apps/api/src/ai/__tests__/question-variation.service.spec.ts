import { describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { QuestionVariationService } from '../services/question-variation.service';
import { DeterministicGenerationProvider } from '../providers/deterministic.provider';
import { ExplanationService } from '../services/explanation.service';
import type { GenerationContext } from '../types/ai.types';

const ctx: GenerationContext = {
  learningObjective: { id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'Compute normal stress.', bloomLevel: 'apply', subjectCode: 'STR' },
  blueprint: null,
  formulas: [{ id: 'f-1', name: 'Normal Stress Equation', expressionText: 'σ = P/A' }],
  misconceptions: [{ id: 'mc-1', publicId: 'MC-STR-003-002-FRM-001', title: 'X', category: 'FRM', description: 'y' }],
  subjectCode: 'STR', topicCode: '001', difficultyBand: 'moderate',
};

describe('QuestionVariationService', () => {
  let svc: QuestionVariationService;
  beforeEach(() => {
    const provider = new DeterministicGenerationProvider();
    svc = new QuestionVariationService(provider, new ExplanationService(provider));
  });

  it('generates the requested number of unique numerical variants', async () => {
    const variants = await svc.generateVariants(ctx, 'numerical', 3, 'seed');
    expect(variants.length).toBe(3);
    const hashes = new Set(variants.map((v) => v.contentHash));
    expect(hashes.size).toBe(3); // all unique
    expect(variants.every((v) => v.variantType === 'numerical')).toBe(true);
  });

  it('generates conceptual variants', async () => {
    const variants = await svc.generateVariants(ctx, 'conceptual', 2, 'seed2');
    expect(variants.length).toBe(2);
    expect(variants.every((v) => v.variantType === 'conceptual')).toBe(true);
  });

  it('rejects an out-of-range count', async () => {
    await expect(svc.generateVariants(ctx, 'numerical', 99, 'seed')).rejects.toThrow(BadRequestException);
  });
});
