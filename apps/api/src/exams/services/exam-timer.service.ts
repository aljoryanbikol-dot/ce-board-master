/**
 * @file exam-timer.service.ts
 * @module Exams/Services
 *
 * ExamTimerService — pure exam-timing logic. Computes remaining time, expiry,
 * and elapsed seconds from an exam's timing fields, accounting for pauses. No
 * persistence and no side effects: it is the single source of timing truth used
 * by the session service to enforce timed exams, resume, and auto-submit.
 *
 * Timing model: `elapsedSeconds` is the accumulated time from completed run
 * segments. While the exam is `in_progress`, the current segment started at
 * `startedAt` (reset on each resume), so live elapsed = elapsedSeconds +
 * (now - startedAt). On pause/submit the current segment is folded into
 * `elapsedSeconds` and `startedAt` is cleared/reset.
 */
import { Injectable } from '@nestjs/common';
import { EXAM_LIMITS } from '../constants/exam.constants';
import type { ExamTimerState } from '../types/exam.types';

interface TimingFields {
  status: string;
  durationMinutes: number;
  startedAt: Date | null;
  expiresAt: Date | null;
  elapsedSeconds: number;
}

@Injectable()
export class ExamTimerService {
  /** Compute the live timer state for an exam at `now`. */
  computeState(exam: TimingFields, now: Date = new Date()): ExamTimerState {
    const durationSec = exam.durationMinutes * 60;
    const elapsed = Math.min(this.liveElapsed(exam, now), durationSec);
    const remaining = Math.max(0, durationSec - elapsed);
    const expired = remaining <= 0 || (exam.expiresAt ? now.getTime() > exam.expiresAt.getTime() : false);

    return {
      status: exam.status,
      durationMinutes: exam.durationMinutes,
      elapsedSeconds: elapsed,
      remainingSeconds: remaining,
      expiresAt: exam.expiresAt ? exam.expiresAt.toISOString() : null,
      expired,
    };
  }

  /** Accumulated elapsed including the in-progress segment. */
  liveElapsed(exam: TimingFields, now: Date = new Date()): number {
    if (exam.status === 'in_progress' && exam.startedAt) {
      return exam.elapsedSeconds + Math.max(0, Math.floor((now.getTime() - exam.startedAt.getTime()) / 1000));
    }
    return exam.elapsedSeconds;
  }

  /** Expiry timestamp from a start time + duration. */
  computeExpiry(startedAt: Date, durationMinutes: number): Date {
    return new Date(startedAt.getTime() + durationMinutes * 60_000);
  }

  /** True if `now` is past expiry (with a small grace window for auto-submit). */
  isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
    if (!expiresAt) return false;
    return now.getTime() > expiresAt.getTime() + EXAM_LIMITS.AUTO_SUBMIT_GRACE_SEC * 1000;
  }
}
