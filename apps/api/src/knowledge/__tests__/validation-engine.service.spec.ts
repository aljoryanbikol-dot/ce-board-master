/**
 * @file validation-engine.service.spec.ts
 * @module Knowledge/Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationEngineService } from '../services/validation-engine.service';
import { PublicIdService } from '../services/public-id.service';

describe('ValidationEngineService', () => {
  let svc: ValidationEngineService;
  beforeEach(() => { svc = new ValidationEngineService(new PublicIdService()); });

  describe('validateLearningObjective', () => {
    it('passes a well-formed LO', () => {
      const r = svc.validateLearningObjective({ publicId: 'LO-STR-001-003-001', subjectCode: 'STR', statement: 'Compute the normal stress in a member.', bloomLevel: 'apply', semver: '1.0.0', sequenceNumber: 1 });
      expect(r.valid).toBe(true);
      expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });
    it('fails an invalid ID format', () => {
      const r = svc.validateLearningObjective({ publicId: 'LO-STR-1-3-1', subjectCode: 'STR', statement: 'A valid statement here.', bloomLevel: 'apply', semver: '1.0.0', sequenceNumber: 1 });
      expect(r.valid).toBe(false);
      expect(r.issues.some((i) => i.field === 'publicId')).toBe(true);
    });
    it('fails an unknown subject code', () => {
      const r = svc.validateLearningObjective({ publicId: 'LO-ZZZ-001-003-001', subjectCode: 'ZZZ', statement: 'A valid statement here.', bloomLevel: 'apply', semver: '1.0.0', sequenceNumber: 1 });
      expect(r.valid).toBe(false);
      expect(r.issues.some((i) => i.field === 'subjectCode')).toBe(true);
    });
    it('fails a too-short statement', () => {
      const r = svc.validateLearningObjective({ publicId: 'LO-STR-001-003-001', subjectCode: 'STR', statement: 'short', bloomLevel: 'apply', semver: '1.0.0', sequenceNumber: 1 });
      expect(r.valid).toBe(false);
      expect(r.issues.some((i) => i.field === 'statement')).toBe(true);
    });
    it('fails a non-semver version', () => {
      const r = svc.validateLearningObjective({ publicId: 'LO-STR-001-003-001', subjectCode: 'STR', statement: 'A valid statement here.', bloomLevel: 'apply', semver: '1.0', sequenceNumber: 1 });
      expect(r.valid).toBe(false);
    });
    it('warns (not errors) on out-of-range sequence', () => {
      const r = svc.validateLearningObjective({ publicId: 'LO-STR-001-003-001', subjectCode: 'STR', statement: 'A valid statement here.', bloomLevel: 'apply', semver: '1.0.0', sequenceNumber: 1500 });
      const warn = r.issues.find((i) => i.field === 'sequenceNumber');
      expect(warn?.severity).toBe('warning');
    });
  });

  describe('validateBlueprint', () => {
    it('passes a well-formed blueprint', () => {
      const r = svc.validateBlueprint({ publicId: 'BP-STR-004-002-CMP-001', subjectCode: 'STR', blueprintType: 'CMP', name: 'Axial stress', semver: '1.0.0' });
      expect(r.valid).toBe(true);
    });
    it('fails an unknown blueprint type', () => {
      const r = svc.validateBlueprint({ publicId: 'BP-STR-004-002-XXX-001', subjectCode: 'STR', blueprintType: 'XXX', name: 'X', semver: '1.0.0' });
      expect(r.valid).toBe(false);
      expect(r.issues.some((i) => i.field === 'blueprintType')).toBe(true);
    });
  });

  describe('validateMisconception', () => {
    it('passes a well-formed misconception', () => {
      const r = svc.validateMisconception({ publicId: 'MC-STR-003-002-FRM-001', subjectCode: 'STR', category: 'FRM', title: 'Stress vs strain', description: 'A detailed description of the error.', semver: '1.0.0' });
      expect(r.valid).toBe(true);
    });
    it('fails an unknown category', () => {
      const r = svc.validateMisconception({ publicId: 'MC-STR-003-002-ZZZ-001', subjectCode: 'STR', category: 'ZZZ', title: 'X', description: 'A detailed description here.', semver: '1.0.0' });
      expect(r.valid).toBe(false);
      expect(r.issues.some((i) => i.field === 'category')).toBe(true);
    });
  });

  describe('validateFormulaId', () => {
    it('passes a valid formula id', () => { expect(svc.validateFormulaId('ST-F-0015').valid).toBe(true); });
    it('fails an invalid formula id', () => { expect(svc.validateFormulaId('ST-0015').valid).toBe(false); });
  });
});
