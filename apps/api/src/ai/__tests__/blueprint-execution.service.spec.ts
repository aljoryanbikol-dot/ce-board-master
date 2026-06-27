import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlueprintExecutionService } from '../services/blueprint-execution.service';
import { DeterministicGenerationProvider } from '../providers/deterministic.provider';
import { ExplanationService } from '../services/explanation.service';
import type { GenerationContext } from '../types/ai.types';

const mockContextBuilder = { fromBlueprint: vi.fn() };
const baseCtx: GenerationContext = {
  learningObjective: { id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'Compute normal stress.', bloomLevel: 'apply', subjectCode: 'STR' },
  blueprint: { id: 'bp-1', publicId: 'BP-STR-004-002-CMP-001', name: 'Axial stress', blueprintType: 'CMP', structure: {} },
  formulas: [{ id: 'f-1', name: 'Normal Stress Equation', expressionText: 'σ = P/A' }],
  misconceptions: [{ id: 'mc-1', publicId: 'MC-STR-003-002-FRM-001', title: 'X', category: 'FRM', description: 'y' }],
  subjectCode: 'STR', topicCode: '004', difficultyBand: 'difficult',
};

describe('BlueprintExecutionService', () => {
  let svc: BlueprintExecutionService;
  beforeEach(() => {
    vi.clearAllMocks();
    const provider = new DeterministicGenerationProvider();
    svc = new BlueprintExecutionService(mockContextBuilder as never, provider, new ExplanationService(provider));
  });

  it('executes a CMP blueprint into numerical drafts', async () => {
    const drafts = await svc.execute(baseCtx, 3, 'seed');
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((d) => d.variantType === 'numerical')).toBe(true); // CMP → numerical
    expect(drafts.every((d) => d.blueprintId === 'BP-STR-004-002-CMP-001')).toBe(true);
  });

  it('delegates context building to the context builder', async () => {
    mockContextBuilder.fromBlueprint.mockResolvedValue(baseCtx);
    const ctx = await svc.buildContext('BP-STR-004-002-CMP-001', 'moderate');
    expect(ctx.blueprint?.publicId).toBe('BP-STR-004-002-CMP-001');
    expect(mockContextBuilder.fromBlueprint).toHaveBeenCalledWith('BP-STR-004-002-CMP-001', 'moderate');
  });

  it('deduplicates identical drafts by content hash', async () => {
    const conceptualCtx = { ...baseCtx, blueprint: { ...baseCtx.blueprint!, blueprintType: 'CON' } };
    const drafts = await svc.execute(conceptualCtx, 5, 'fixed-seed');
    const hashes = new Set(drafts.map((d) => d.contentHash));
    expect(hashes.size).toBe(drafts.length);
  });
});
