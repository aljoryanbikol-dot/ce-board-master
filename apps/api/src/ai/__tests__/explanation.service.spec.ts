import { describe, it, expect, beforeEach } from 'vitest';
import { ExplanationService } from '../services/explanation.service';
import { DeterministicGenerationProvider } from '../providers/deterministic.provider';
import type { GeneratedQuestionDraft } from '../types/ai.types';

const draft: GeneratedQuestionDraft = {
  stemText: 'Compute stress.', choices: [{ letter: 'A', text: 'x', isCorrect: true }],
  correctChoice: 'A', explanationText: 'Original explanation citing the principle.',
  solutionSteps: ['Step 1', 'Step 2'], bloomLevel: 'apply', difficultyBand: 'moderate',
  learningObjectiveId: 'LO-STR-001-003-001', blueprintId: null, formulaIds: [], misconceptionIds: [],
  estSolvingTimeSec: 120, variantType: 'base', contentHash: 'h1',
};

describe('ExplanationService', () => {
  let svc: ExplanationService;
  beforeEach(() => { svc = new ExplanationService(new DeterministicGenerationProvider()); });

  it('returns explanation + solution steps', async () => {
    const result = await svc.generate(draft);
    expect(result.explanationText.length).toBeGreaterThan(0);
    expect(result.solutionSteps.length).toBe(2);
  });

  it('enrich attaches explanation immutably', async () => {
    const enriched = await svc.enrich(draft);
    expect(enriched).not.toBe(draft);
    expect(enriched.explanationText).toBe(draft.explanationText);
  });
});
