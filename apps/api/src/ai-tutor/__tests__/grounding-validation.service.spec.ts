/**
 * @file grounding-validation.service.spec.ts
 * @module AITutor/Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GroundingValidationService } from '../services/grounding-validation.service';
import type { TutorContext } from '../types/tutor.types';

const ctx = (over: Partial<TutorContext> = {}): TutorContext => ({
  subjectId: 's-1', topicId: 't-1', learningObjectives: [], formulas: [], misconceptions: [], memorySummary: null, recentTurns: [], ...over,
});

describe('GroundingValidationService (pure)', () => {
  let svc: GroundingValidationService;
  beforeEach(() => { svc = new GroundingValidationService(); });

  it('fails on empty content', () => {
    expect(svc.validate('', ctx()).ok).toBe(false);
  });

  it('passes (ungrounded) when there is no KB context', () => {
    const r = svc.validate('Some answer.', ctx());
    expect(r.ok).toBe(true);
    expect(r.reasons).toContain('no_kb_context');
  });

  it('passes when the answer references a formula in context', () => {
    const r = svc.validate('Use Ohm\'s Law to solve this.', ctx({ formulas: [{ id: 'f-1', name: "Ohm's Law", expression: 'V=IR' }] }));
    expect(r.ok).toBe(true);
  });

  it('passes when the answer references an LO public id', () => {
    const r = svc.validate('Grounded in LO-CE-101 about statics.', ctx({ learningObjectives: [{ publicId: 'LO-CE-101', statement: 'Understand statics equilibrium' }] }));
    expect(r.ok).toBe(true);
  });

  it('passes on lexical overlap with an LO statement', () => {
    const r = svc.validate('This involves equilibrium of forces in statics systems.', ctx({ learningObjectives: [{ publicId: 'LO-1', statement: 'Understand equilibrium in statics systems' }] }));
    expect(r.ok).toBe(true);
  });

  it('fails when KB context exists but the answer references none of it', () => {
    const r = svc.validate('Completely unrelated text about cooking.', ctx({ formulas: [{ id: 'f-1', name: "Ohm's Law", expression: 'V=IR' }] }));
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('no_context_reference');
  });

  it('passes when the answer references a misconception title', () => {
    const r = svc.validate('Watch out for the Moment Sign Error here.', ctx({ misconceptions: [{ publicId: 'MIS-1', title: 'Moment Sign Error', description: 'Students flip signs.' }] }));
    expect(r.ok).toBe(true);
  });
});
