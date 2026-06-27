import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AICapabilityController } from '../controllers/ai-capability.controller';

describe('AICapabilityController', () => {
  const distractors = { generate: vi.fn().mockResolvedValue({ learningObjectiveId: 'LO-STR-001-003-001', distractors: [] }) };
  let controller: AICapabilityController;
  beforeEach(() => { vi.clearAllMocks(); controller = new AICapabilityController(distractors as never); });

  it('delegates distractor generation', async () => {
    await controller.generateDistractors({ learningObjectiveId: 'LO-STR-001-003-001', count: 3 } as never);
    expect(distractors.generate).toHaveBeenCalledWith({ learningObjectiveId: 'LO-STR-001-003-001', count: 3 });
  });
});
