/**
 * @file public-id.service.spec.ts
 * @module Knowledge/Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PublicIdService } from '../services/public-id.service';

describe('PublicIdService', () => {
  let svc: PublicIdService;
  beforeEach(() => { svc = new PublicIdService(); });

  describe('validation', () => {
    it('accepts a valid LO id', () => { expect(svc.validateLearningObjectiveId('LO-STR-001-003-001')).toBe(true); });
    it('rejects a malformed LO id', () => {
      expect(svc.validateLearningObjectiveId('LO-STR-1-3-1')).toBe(false);
      expect(svc.validateLearningObjectiveId('XX-STR-001-003-001')).toBe(false);
    });
    it('accepts a valid Blueprint id', () => { expect(svc.validateBlueprintId('BP-STR-004-002-CMP-001')).toBe(true); });
    it('rejects a Blueprint id with a 4-letter type', () => { expect(svc.validateBlueprintId('BP-STR-004-002-COMP-001')).toBe(false); });
    it('accepts a valid Misconception id', () => { expect(svc.validateMisconceptionId('MC-STR-003-002-FRM-001')).toBe(true); });
    it('accepts valid Formula ids', () => {
      expect(svc.validateFormulaId('ST-F-0015')).toBe(true);
      expect(svc.validateFormulaId('M-F-0001')).toBe(true);
    });
    it('rejects a Formula id with 3 digits', () => { expect(svc.validateFormulaId('ST-F-015')).toBe(false); });
  });

  describe('subject/type/category codes', () => {
    it('knows valid subject codes', () => {
      expect(svc.isValidSubjectCode('STR')).toBe(true);
      expect(svc.isValidSubjectCode('ZZZ')).toBe(false);
    });
    it('knows valid blueprint types', () => {
      expect(svc.isValidBlueprintType('CMP')).toBe(true);
      expect(svc.isValidBlueprintType('XXX')).toBe(false);
    });
    it('knows valid misconception categories', () => {
      expect(svc.isValidMisconceptionCategory('FRM')).toBe(true);
      expect(svc.isValidMisconceptionCategory('ZZZ')).toBe(false);
    });
  });

  describe('parse', () => {
    it('parses an LO id into components', () => {
      const p = svc.parse('LO-STR-001-003-007');
      expect(p).toEqual({ prefix: 'LO', subjectCode: 'STR', topicCode: '001', subtopicCode: '003', qualifier: null, sequence: 7 });
    });
    it('parses a Blueprint id with its type qualifier', () => {
      const p = svc.parse('BP-STR-004-002-CMP-001');
      expect(p?.prefix).toBe('BP');
      expect(p?.qualifier).toBe('CMP');
      expect(p?.sequence).toBe(1);
    });
    it('parses a Misconception id with its category qualifier', () => {
      const p = svc.parse('MC-GEO-010-005-UNT-099');
      expect(p?.prefix).toBe('MC');
      expect(p?.qualifier).toBe('UNT');
      expect(p?.sequence).toBe(99);
    });
    it('returns null for an invalid id', () => { expect(svc.parse('not-an-id')).toBeNull(); });
  });

  describe('build (zero-padding)', () => {
    it('builds an LO id with padding', () => {
      expect(svc.buildLearningObjectiveId('STR', 1, 3, 1)).toBe('LO-STR-001-003-001');
    });
    it('builds a Blueprint id', () => {
      expect(svc.buildBlueprintId('STR', 4, 2, 'CMP', 1)).toBe('BP-STR-004-002-CMP-001');
    });
    it('builds a Misconception id', () => {
      expect(svc.buildMisconceptionId('STR', 3, 2, 'FRM', 1)).toBe('MC-STR-003-002-FRM-001');
    });
    it('round-trips build → validate', () => {
      const id = svc.buildLearningObjectiveId('HYD', 12, 4, 250);
      expect(svc.validateLearningObjectiveId(id)).toBe(true);
    });
  });
});
