import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LearningCoachService } from '../services/learning-coach.service';

function mocks() {
  const tx = { tutorCoachingNote: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'n-1', ...data, isRead: false, createdAt: new Date() })) } };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    tutorCoachingNote: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}), create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'n-1', ...data, isRead: false, createdAt: new Date() })) },
  };
  const cache = { del: vi.fn() };
  const progress = {
    weakTopics: vi.fn().mockResolvedValue([{ topicId: 't-2', subjectId: 's-1', accuracy: 0.5, tier: 'developing' }]),
    getKnowledgeGaps: vi.fn().mockResolvedValue([{ topicId: 't-1', subjectId: 's-1', severity: 'critical', accuracy: 0.3 }]),
  };
  const examAnalytics = { weaknessStrength: vi.fn().mockResolvedValue({ weaknesses: [{ subjectId: 's-1', topicId: 't-1', scorePercent: 40 }], strengths: [] }) };
  const events = { emit: vi.fn() };
  const svc = new LearningCoachService(prisma as never, cache as never, progress as never, examAnalytics as never, events as never);
  return { prisma, cache, progress, examAnalytics, events, tx, svc };
}

describe('LearningCoachService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('generateCoaching', () => {
    it('creates notes from gaps + weak topics (deduped) and sorts by priority', async () => {
      const notes = await m.svc.generateCoaching('u-1');
      expect(notes.length).toBeGreaterThanOrEqual(2);
      // gap (priority ~80) should come before weak_topic (~60)
      expect(notes[0]!.priority).toBeGreaterThanOrEqual(notes[notes.length - 1]!.priority);
      expect(m.tx.tutorCoachingNote.deleteMany).toHaveBeenCalled();
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('coaching.generated'), expect.any(Object));
    });
    it('throws when there is nothing to coach', async () => {
      m.progress.weakTopics.mockResolvedValue([]);
      m.progress.getKnowledgeGaps.mockResolvedValue([]);
      await expect(m.svc.generateCoaching('u-1')).rejects.toThrow(NotFoundException);
    });
    it('dedupes a weak topic that is already a gap', async () => {
      m.progress.weakTopics.mockResolvedValue([{ topicId: 't-1', subjectId: 's-1', accuracy: 0.3, tier: 'novice' }]); // same as gap
      const notes = await m.svc.generateCoaching('u-1');
      expect(notes.filter((n) => n.topicId === 't-1')).toHaveLength(1);
    });
  });

  describe('coachFromExam', () => {
    it('creates exam_mistake notes from weaknesses', async () => {
      const notes = await m.svc.coachFromExam('u-1', 'ex-1');
      expect(notes[0]!.trigger).toBe('exam_mistake');
      expect(notes[0]!.priority).toBeGreaterThanOrEqual(80);
    });
    it('throws ownership violation when analytics returns null', async () => {
      m.examAnalytics.weaknessStrength.mockResolvedValue(null);
      await expect(m.svc.coachFromExam('u-1', 'ex-1')).rejects.toThrow(ForbiddenException);
    });
    it('throws when there are no weaknesses', async () => {
      m.examAnalytics.weaknessStrength.mockResolvedValue({ weaknesses: [], strengths: [] });
      await expect(m.svc.coachFromExam('u-1', 'ex-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markRead / dismiss ownership', () => {
    it('marks an owned note read', async () => {
      m.prisma.tutorCoachingNote.findUnique.mockResolvedValue({ id: 'n-1', userId: 'u-1' });
      const r = await m.svc.markRead('u-1', 'n-1');
      expect(r.read).toBe(true);
    });
    it('rejects marking a non-owned note', async () => {
      m.prisma.tutorCoachingNote.findUnique.mockResolvedValue({ id: 'n-1', userId: 'other' });
      await expect(m.svc.markRead('u-1', 'n-1')).rejects.toThrow(ForbiddenException);
    });
    it('throws on a missing note', async () => {
      m.prisma.tutorCoachingNote.findUnique.mockResolvedValue(null);
      await expect(m.svc.dismiss('u-1', 'n-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listCoaching', () => {
    it('lists notes (optionally unread only)', async () => {
      m.prisma.tutorCoachingNote.findMany.mockResolvedValue([{ id: 'n-1', trigger: 'weak_topic', title: 'T', message: 'M', subjectId: 's-1', topicId: 't-1', priority: 60, isRead: false, createdAt: new Date() }]);
      const notes = await m.svc.listCoaching('u-1', { unreadOnly: true, limit: 20 });
      expect(notes).toHaveLength(1);
    });
  });
});
