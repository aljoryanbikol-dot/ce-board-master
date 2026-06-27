/**
 * @file exam-scoring.service.spec.ts
 * @module Exams/Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ExamScoringService, type GradedQuestion } from '../services/exam-scoring.service';

const g = (over: Partial<GradedQuestion>): GradedQuestion => ({ subjectId: 's-1', topicId: 't-1', selectedChoice: 'A', correctChoice: 'A', isCorrect: true, ...over });

describe('ExamScoringService (pure)', () => {
  let svc: ExamScoringService;
  beforeEach(() => { svc = new ExamScoringService(); });

  describe('isCorrect', () => {
    it('matches selected to correct', () => { expect(svc.isCorrect('B', 'B')).toBe(true); });
    it('false on mismatch', () => { expect(svc.isCorrect('A', 'B')).toBe(false); });
    it('false when unanswered', () => { expect(svc.isCorrect(null, 'B')).toBe(false); });
  });

  describe('computeBreakdown', () => {
    it('computes overall score and pass/fail', () => {
      const graded = [g({ isCorrect: true }), g({ isCorrect: true }), g({ isCorrect: false, selectedChoice: 'B' }), g({ selectedChoice: null, isCorrect: false })];
      const b = svc.computeBreakdown(graded, 4, 70, 1200);
      expect(b.correctCount).toBe(2);
      expect(b.answeredCount).toBe(3);
      expect(b.skippedCount).toBe(1);
      expect(b.incorrectCount).toBe(1);
      expect(b.scorePercent).toBe(50);
      expect(b.passed).toBe(false);
    });
    it('passes when at or above the passing score', () => {
      const graded = [g({ isCorrect: true }), g({ isCorrect: true }), g({ isCorrect: true }), g({ isCorrect: false, selectedChoice: 'B' })];
      const b = svc.computeBreakdown(graded, 4, 70, 600);
      expect(b.scorePercent).toBe(75);
      expect(b.passed).toBe(true);
    });
    it('groups by subject', () => {
      const graded = [g({ subjectId: 's-1', isCorrect: true }), g({ subjectId: 's-1', isCorrect: false, selectedChoice: 'B' }), g({ subjectId: 's-2', isCorrect: true })];
      const b = svc.computeBreakdown(graded, 3, 70, 100);
      const s1 = b.bySubject.find((s) => s.subjectId === 's-1')!;
      expect(s1.total).toBe(2); expect(s1.correct).toBe(1); expect(s1.scorePercent).toBe(50);
      const s2 = b.bySubject.find((s) => s.subjectId === 's-2')!;
      expect(s2.scorePercent).toBe(100);
    });
    it('groups by topic, skipping null topics', () => {
      const graded = [g({ topicId: 't-1', isCorrect: true }), g({ topicId: null, isCorrect: true })];
      const b = svc.computeBreakdown(graded, 2, 70, 100);
      expect(b.byTopic).toHaveLength(1);
      expect(b.byTopic[0]!.topicId).toBe('t-1');
    });
    it('handles an all-skipped exam (0%)', () => {
      const graded = [g({ selectedChoice: null, isCorrect: false }), g({ selectedChoice: null, isCorrect: false })];
      const b = svc.computeBreakdown(graded, 2, 70, 0);
      expect(b.scorePercent).toBe(0);
      expect(b.answeredCount).toBe(0);
      expect(b.skippedCount).toBe(2);
    });
    it('carries weightPercent into subject scores', () => {
      const graded = [g({ subjectId: 's-1', weightPercent: 20, isCorrect: true })];
      const b = svc.computeBreakdown(graded, 1, 70, 50);
      expect(b.bySubject[0]!.weightPercent).toBe(20);
    });
  });
});
