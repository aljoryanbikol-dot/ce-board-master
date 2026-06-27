/**
 * @file exam-timer.service.spec.ts
 * @module Exams/Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ExamTimerService } from '../services/exam-timer.service';
import { EXAM_LIMITS } from '../constants/exam.constants';

describe('ExamTimerService (pure)', () => {
  let svc: ExamTimerService;
  beforeEach(() => { svc = new ExamTimerService(); });

  describe('computeExpiry', () => {
    it('adds duration minutes to the start time', () => {
      const start = new Date('2026-06-27T10:00:00Z');
      const expiry = svc.computeExpiry(start, 180);
      expect(expiry.toISOString()).toBe('2026-06-27T13:00:00.000Z');
    });
  });

  describe('liveElapsed', () => {
    it('returns stored elapsed when not in progress', () => {
      const exam = { status: 'paused', durationMinutes: 60, startedAt: null, expiresAt: null, elapsedSeconds: 120 };
      expect(svc.liveElapsed(exam, new Date())).toBe(120);
    });
    it('adds the live segment while in progress', () => {
      const now = new Date('2026-06-27T10:05:00Z');
      const exam = { status: 'in_progress', durationMinutes: 60, startedAt: new Date('2026-06-27T10:00:00Z'), expiresAt: null, elapsedSeconds: 60 };
      expect(svc.liveElapsed(exam, now)).toBe(60 + 300); // 60 stored + 5 min live
    });
  });

  describe('computeState', () => {
    it('computes remaining time within an active exam', () => {
      const now = new Date('2026-06-27T10:10:00Z');
      const exam = { status: 'in_progress', durationMinutes: 60, startedAt: new Date('2026-06-27T10:00:00Z'), expiresAt: new Date('2026-06-27T11:00:00Z'), elapsedSeconds: 0 };
      const state = svc.computeState(exam, now);
      expect(state.elapsedSeconds).toBe(600);
      expect(state.remainingSeconds).toBe(3000);
      expect(state.expired).toBe(false);
    });
    it('marks expired when past expiry', () => {
      const now = new Date('2026-06-27T11:30:00Z');
      const exam = { status: 'in_progress', durationMinutes: 60, startedAt: new Date('2026-06-27T10:00:00Z'), expiresAt: new Date('2026-06-27T11:00:00Z'), elapsedSeconds: 0 };
      expect(svc.computeState(exam, now).expired).toBe(true);
    });
    it('clamps elapsed at the duration', () => {
      const now = new Date('2026-06-27T13:00:00Z');
      const exam = { status: 'in_progress', durationMinutes: 60, startedAt: new Date('2026-06-27T10:00:00Z'), expiresAt: new Date('2026-06-27T11:00:00Z'), elapsedSeconds: 0 };
      const state = svc.computeState(exam, now);
      expect(state.elapsedSeconds).toBe(3600);
      expect(state.remainingSeconds).toBe(0);
    });
  });

  describe('isExpired', () => {
    it('false before expiry', () => {
      expect(svc.isExpired(new Date(Date.now() + 60_000))).toBe(false);
    });
    it('false within the grace window', () => {
      expect(svc.isExpired(new Date(Date.now() - (EXAM_LIMITS.AUTO_SUBMIT_GRACE_SEC - 1) * 1000))).toBe(false);
    });
    it('true past expiry + grace', () => {
      expect(svc.isExpired(new Date(Date.now() - (EXAM_LIMITS.AUTO_SUBMIT_GRACE_SEC + 10) * 1000))).toBe(true);
    });
    it('false when no expiry set', () => {
      expect(svc.isExpired(null)).toBe(false);
    });
  });
});
