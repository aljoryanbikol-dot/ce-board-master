/**
 * @file learning-coach.service.ts
 * @module AITutor/Services
 *
 * LearningCoachService — the AI Learning Coach. It synthesizes coaching notes
 * from multiple signals: weak topics and knowledge gaps (Student Platform),
 * recent exam mistakes (Mock Examination Engine analytics), and Knowledge Base
 * misconceptions. Notes are persisted (ownership-scoped), prioritized, and can
 * be marked read/dismissed. This is composition over the existing engines — it
 * holds no progress/scoring logic of its own.
 */
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { ProgressTrackingService } from '../../student/services/progress-tracking.service';
import { ExamAnalyticsService } from '../../exams/services/exam-analytics.service';
import { TutorErrors } from '../errors/tutor.errors';
import { EVENTS, CACHE_KEYS } from '../../common/constants';
import { COACHING_PRIORITY } from '../constants/tutor.constants';
import type { CoachingNoteView } from '../types/tutor.types';

@Injectable()
export class LearningCoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly progress: ProgressTrackingService,
    private readonly examAnalytics: ExamAnalyticsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Regenerate coaching notes for a student from the latest signals. */
  async generateCoaching(userId: string): Promise<CoachingNoteView[]> {
    const [weakTopics, gaps] = await Promise.all([
      this.progress.weakTopics(userId, 5),
      this.progress.getKnowledgeGaps(userId),
    ]);

    const notes: { trigger: string; subjectId: string | null; topicId: string | null; title: string; message: string; priority: number; sourceType?: string; sourceId?: string }[] = [];

    for (const gap of gaps) {
      notes.push({
        trigger: 'knowledge_gap', subjectId: gap.subjectId, topicId: gap.topicId,
        title: `Close a ${gap.severity} knowledge gap`,
        message: `Your accuracy on this topic is ${Math.round(gap.accuracy * 100)}%. Focus a short, targeted session here to close the gap.`,
        priority: COACHING_PRIORITY.knowledge_gap + (gap.severity === 'critical' ? 10 : 0),
      });
    }
    for (const t of weakTopics) {
      if (gaps.some((g: { topicId: string }) => g.topicId === t.topicId)) continue; // avoid duplicate of a gap
      notes.push({
        trigger: 'weak_topic', subjectId: t.subjectId, topicId: t.topicId,
        title: 'Strengthen a weak topic',
        message: `You're at ${Math.round(t.accuracy * 100)}% accuracy here (tier: ${t.tier}). A few focused questions will move the needle.`,
        priority: COACHING_PRIORITY.weak_topic,
      });
    }

    if (notes.length === 0) throw TutorErrors.noCoachingAvailable();

    // Replace prior non-dismissed auto notes with the fresh set (idempotent-ish refresh).
    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.tutorCoachingNote.deleteMany({ where: { userId, isDismissed: false, sourceType: null } });
      const rows = [];
      for (const n of notes) {
        rows.push(await tx.tutorCoachingNote.create({
          data: { userId, trigger: n.trigger as never, subjectId: n.subjectId, topicId: n.topicId, title: n.title, message: n.message, priority: n.priority },
        }));
      }
      return rows;
    });

    this.eventEmitter.emit(EVENTS.TUTOR_COACHING_GENERATED, { userId, count: created.length });
    await this.cache.del(CACHE_KEYS.tutor.coaching(userId));
    return created.sort((a: any, b: any) => b.priority - a.priority).map(this.toView);
  }

  /** Generate a coaching note from a specific exam's mistakes. */
  async coachFromExam(userId: string, examId: string): Promise<CoachingNoteView[]> {
    const ws = await this.examAnalytics.weaknessStrength(userId, examId);
    if (!ws) throw TutorErrors.ownershipViolation();
    if (ws.weaknesses.length === 0) throw TutorErrors.noCoachingAvailable();

    const created = [];
    for (const w of ws.weaknesses.slice(0, 5)) {
      created.push(await this.prisma.tutorCoachingNote.create({
        data: {
          userId, trigger: 'exam_mistake', subjectId: w.subjectId, topicId: w.topicId ?? null,
          title: 'Review exam mistakes',
          message: `On your recent exam you scored ${Math.round(w.scorePercent)}% on this area. Review the incorrect answers, then retry similar questions.`,
          priority: COACHING_PRIORITY.exam_mistake, sourceType: 'exam', sourceId: examId,
        },
      }));
    }
    this.eventEmitter.emit(EVENTS.TUTOR_COACHING_GENERATED, { userId, count: created.length, examId });
    await this.cache.del(CACHE_KEYS.tutor.coaching(userId));
    return created.sort((a, b) => b.priority - a.priority).map(this.toView);
  }

  async listCoaching(userId: string, opts: { unreadOnly?: boolean; limit: number }): Promise<CoachingNoteView[]> {
    const rows = await this.prisma.tutorCoachingNote.findMany({
      where: { userId, isDismissed: false, ...(opts.unreadOnly && { isRead: false }) },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: opts.limit,
    });
    return rows.map(this.toView);
  }

  async markRead(userId: string, noteId: string) {
    await this.ownNote(userId, noteId);
    await this.prisma.tutorCoachingNote.update({ where: { id: noteId }, data: { isRead: true } });
    await this.cache.del(CACHE_KEYS.tutor.coaching(userId));
    return { read: true };
  }

  async dismiss(userId: string, noteId: string) {
    await this.ownNote(userId, noteId);
    await this.prisma.tutorCoachingNote.update({ where: { id: noteId }, data: { isDismissed: true } });
    await this.cache.del(CACHE_KEYS.tutor.coaching(userId));
    return { dismissed: true };
  }

  private async ownNote(userId: string, noteId: string) {
    const note = await this.prisma.tutorCoachingNote.findUnique({ where: { id: noteId } });
    if (!note) throw TutorErrors.coachingNotFound(noteId);
    if (note.userId !== userId) throw TutorErrors.ownershipViolation();
    return note;
  }

  private toView(n: { id: string; trigger: string; title: string; message: string; subjectId: string | null; topicId: string | null; priority: number; isRead: boolean; createdAt: Date }): CoachingNoteView {
    return { id: n.id, trigger: n.trigger, title: n.title, message: n.message, subjectId: n.subjectId, topicId: n.topicId, priority: n.priority, isRead: n.isRead, createdAt: n.createdAt.toISOString() };
  }
}
