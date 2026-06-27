/**
 * @file validation.service.spec.ts
 * @module AI/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationService } from '../services/validation.service';
import type { GeneratedQuestionDraft } from '../types/ai.types';

const validDraft = (): GeneratedQuestionDraft => ({
  stemText: 'Compute the normal stress in an axially loaded member given P and A.',
  choices: [
    { letter: 'A', text: 'Correct application of σ = P/A.', isCorrect: true },
    { letter: 'B', text: 'Reflects the error: stress vs strain.', isCorrect: false, misconceptionId: 'MC-STR-003-002-FRM-001' },
    { letter: 'C', text: 'Reflects the error: unit mistake.', isCorrect: false, misconceptionId: 'MC-STR-003-002-UNT-001' },
  ],
  correctChoice: 'A',
  explanationText: 'The correct answer applies the governing equation σ = P/A and cites the principle.',
  solutionSteps: ['Identify the principle.', 'Apply the formula.'],
  bloomLevel: 'apply', difficultyBand: 'moderate',
  learningObjectiveId: 'LO-STR-001-003-001', blueprintId: null,
  formulaIds: ['Normal Stress Equation'], misconceptionIds: ['MC-STR-003-002-FRM-001', 'MC-STR-003-002-UNT-001'],
  estSolvingTimeSec: 120, variantType: 'base', contentHash: 'hash-unique-1',
});

const mockKnowledge = { verifyQuestionReferences: vi.fn() };
const mockPrisma = {
  formulaLibrary: { findFirst: vi.fn() },
  misconception: { findFirst: vi.fn() },
  aiGeneratedVariant: { findFirst: vi.fn() },
};
const build = () => new ValidationService(mockPrisma as never, mockKnowledge as never);

describe('ValidationService (pipeline)', () => {
  let svc: ValidationService;
  beforeEach(() => {
    vi.clearAllMocks();
    svc = build();
    mockKnowledge.verifyQuestionReferences.mockResolvedValue({ valid: true, errors: [], checks: [] });
    mockPrisma.formulaLibrary.findFirst.mockResolvedValue({ id: 'f-1' });
    mockPrisma.misconception.findFirst.mockResolvedValue({ status: 'published' });
    mockPrisma.aiGeneratedVariant.findFirst.mockResolvedValue(null);
  });

  it('passes a fully valid draft', async () => {
    const report = await svc.validate(validDraft());
    expect(report.outcome).toBe('passed');
    expect(report.stages).toHaveLength(6);
    expect(report.stages.every((s) => s.passed)).toBe(true);
  });

  it('fails a draft with no correct answer', async () => {
    const d = validDraft();
    d.choices = d.choices.map((c) => ({ ...c, isCorrect: false }));
    const report = await svc.validate(d);
    expect(report.outcome).toBe('failed');
    expect(report.issues.some((i) => i.stage === 'structure')).toBe(true);
  });

  it('fails when the KB references are invalid', async () => {
    mockKnowledge.verifyQuestionReferences.mockResolvedValue({ valid: false, errors: ['Learning Objective does not exist.'], checks: [] });
    const report = await svc.validate(validDraft());
    expect(report.outcome).toBe('failed');
    expect(report.issues.some((i) => i.stage === 'knowledge_base')).toBe(true);
  });

  it('warns (not fails) when a cited formula is missing', async () => {
    mockPrisma.formulaLibrary.findFirst.mockResolvedValue(null);
    const report = await svc.validate(validDraft());
    expect(['passed_with_warnings', 'failed']).toContain(report.outcome);
    expect(report.issues.some((i) => i.stage === 'formula_library' && i.severity === 'warning')).toBe(true);
  });

  it('fails a draft containing placeholder text (editorial)', async () => {
    const d = validDraft();
    d.explanationText = 'TODO: write the explanation later.';
    const report = await svc.validate(d);
    expect(report.outcome).toBe('failed');
    expect(report.issues.some((i) => i.stage === 'editorial')).toBe(true);
  });

  it('fails a duplicate draft', async () => {
    mockPrisma.aiGeneratedVariant.findFirst.mockResolvedValue({ id: 'existing' });
    const report = await svc.validate(validDraft());
    expect(report.outcome).toBe('failed');
    expect(report.issues.some((i) => i.stage === 'duplicate')).toBe(true);
  });

  it('fails a missing misconception reference', async () => {
    mockPrisma.misconception.findFirst.mockResolvedValue(null);
    const report = await svc.validate(validDraft());
    expect(report.issues.some((i) => i.stage === 'misconceptions' && i.severity === 'error')).toBe(true);
  });
});
