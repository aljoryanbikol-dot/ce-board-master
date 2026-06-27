import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistractorService } from '../services/distractor.service';
import { DeterministicGenerationProvider } from '../providers/deterministic.provider';
import type { GenerationContext } from '../types/ai.types';

const mockContextBuilder = { fromLearningObjective: vi.fn() };
const ctx: GenerationContext = {
  learningObjective: { id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'Compute normal stress.', bloomLevel: 'apply', subjectCode: 'STR' },
  blueprint: null,
  formulas: [{ id: 'f-1', name: 'Normal Stress Equation', expressionText: 'σ = P/A' }],
  misconceptions: [
    { id: 'mc-1', publicId: 'MC-STR-003-002-FRM-001', title: 'Stress vs strain', category: 'FRM', description: 'x' },
    { id: 'mc-2', publicId: 'MC-STR-003-002-UNT-001', title: 'Unit error', category: 'UNT', description: 'y' },
  ],
  subjectCode: 'STR', topicCode: '001', difficultyBand: 'moderate',
};

describe('DistractorService', () => {
  let svc: DistractorService;
  beforeEach(() => {
    vi.clearAllMocks();
    svc = new DistractorService(mockContextBuilder as never, new DeterministicGenerationProvider());
    mockContextBuilder.fromLearningObjective.mockResolvedValue(ctx);
  });

  it('generates misconception-grounded distractors', async () => {
    const result = await svc.generate({ learningObjectiveId: 'LO-STR-001-003-001', count: 3 } as never);
    expect(result.distractors.length).toBeGreaterThan(0);
    expect(result.distractors.every((d) => !d.isCorrect)).toBe(true);
    expect(result.learningObjectiveId).toBe('LO-STR-001-003-001');
  });

  it('caps the number of distractors', async () => {
    const result = await svc.generate({ learningObjectiveId: 'LO-STR-001-003-001', count: 3 } as never);
    expect(result.distractors.length).toBeLessThanOrEqual(3);
  });
});
