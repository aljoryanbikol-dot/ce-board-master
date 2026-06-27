/**
 * @file document-parser.service.spec.ts
 * @module Knowledge/Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentParserService } from '../services/document-parser.service';

const SAMPLE = `**CE Board Master**

**Book 11**

**Chapter 1**

**1.1 Mission**

The mission of the Learning Objectives Master Library is to establish a complete competency framework.

**1.2 Goals**

The library shall standardize competencies and improve consistency.

**4.2 Identifier Structure**

The official Learning Objective ID format shall be LO-Subject-Topic-Subtopic-Number.`;

describe('DocumentParserService', () => {
  let svc: DocumentParserService;
  beforeEach(() => { svc = new DocumentParserService(); });

  describe('checksum', () => {
    it('is deterministic for identical content', () => {
      expect(svc.checksum(SAMPLE)).toBe(svc.checksum(SAMPLE));
    });
    it('ignores trailing whitespace / CRLF differences', () => {
      expect(svc.checksum('abc\r\ndef')).toBe(svc.checksum('abc\ndef  '));
    });
    it('changes when content changes', () => {
      expect(svc.checksum(SAMPLE)).not.toBe(svc.checksum(SAMPLE + ' extra'));
    });
    it('produces a 64-char hex (sha256)', () => {
      expect(svc.checksum(SAMPLE)).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('parse', () => {
    it('returns checksum, wordCount, and sections', () => {
      const parsed = svc.parse(SAMPLE);
      expect(parsed.contentChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(parsed.wordCount).toBeGreaterThan(10);
      expect(parsed.sections.length).toBeGreaterThan(0);
    });

    it('extracts numbered sub-section headings', () => {
      const parsed = svc.parse(SAMPLE);
      const headings = parsed.sections.map((s) => s.heading);
      expect(headings.some((h) => h.includes('1.1 Mission'))).toBe(true);
      expect(headings.some((h) => h.includes('4.2 Identifier Structure'))).toBe(true);
    });

    it('assigns deeper heading levels to dotted numbering', () => {
      const parsed = svc.parse(SAMPLE);
      const mission = parsed.sections.find((s) => s.heading.includes('1.1'));
      expect(mission?.level).toBe(2); // one dot → level 2
    });

    it('gives each section a unique anchor', () => {
      const parsed = svc.parse(SAMPLE);
      const anchors = parsed.sections.map((s) => s.anchor);
      expect(new Set(anchors).size).toBe(anchors.length);
    });

    it('captures body text under a heading', () => {
      const parsed = svc.parse(SAMPLE);
      const mission = parsed.sections.find((s) => s.heading.includes('Mission'));
      expect(mission?.bodyText).toContain('competency framework');
      expect(mission?.wordCount).toBeGreaterThan(0);
    });

    it('handles empty input without throwing', () => {
      const parsed = svc.parse('');
      expect(parsed.wordCount).toBe(0);
      expect(parsed.sections).toEqual([]);
    });
  });
});
