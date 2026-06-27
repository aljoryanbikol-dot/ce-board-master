/**
 * @file learning-path.service.ts
 * @module Student/Services
 *
 * LearningPathService — generates a personalized, ordered learning path from the
 * student's knowledge gaps (weakest topics first), persists it, and exposes the
 * active path. AI-ready: generation is encapsulated so an AI planner can replace
 * the heuristic ordering behind generate() without changing the API.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ProgressTrackingService } from './progress-tracking.service';
import { EVENTS } from '../../common/constants';
import { GAP_RULES } from '../constants/student.constants';
import type { LearningPathStep } from '../types/student.types';

@Injectable()
export class LearningPathService {
  private readonly logger = new Logger(LearningPathService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressTrackingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async generate(userId: string): Promise<{ id: string; title: string; steps: LearningPathStep[] }> {
    // Refresh gaps, then order weakest-first into a path.
    await this.progress.detectKnowledgeGaps(userId);
    const gaps = await this.prisma.knowledgeGap.findMany({ where: { userId, resolvedAt: null }, orderBy: [{ severity: 'desc' }, { accuracy: 'asc' }], take: 15 });

    const steps: LearningPathStep[] = gaps.map((g: { topicId: string; subjectId: string; accuracy: number; severity: string }, i: number) => ({
      order: i + 1, topicId: g.topicId, subjectId: g.subjectId,
      reason: `Close ${g.severity} gap (current accuracy ${Math.round(g.accuracy * 100)}%).`,
      targetAccuracy: GAP_RULES.MINOR_ACCURACY, currentAccuracy: g.accuracy,
    }));

    // Deactivate prior paths, persist the new one.
    await this.prisma.learningPath.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
    const path = await this.prisma.learningPath.create({
      data: { userId, title: `Personalized path — ${new Date().toISOString().slice(0, 10)}`, steps: steps as unknown as Prisma.InputJsonValue, isActive: true },
    });
    this.eventEmitter.emit(EVENTS.STUDENT_PATH_GENERATED, { userId, pathId: path.id, steps: steps.length });
    this.logger.log({ message: 'Learning path generated', userId, steps: steps.length });
    return { id: path.id, title: path.title, steps };
  }

  async getActive(userId: string) {
    const path = await this.prisma.learningPath.findFirst({ where: { userId, isActive: true }, orderBy: { generatedAt: 'desc' } });
    if (!path) return null;
    return { id: path.id, title: path.title, steps: path.steps, generatedAt: path.generatedAt.toISOString() };
  }
}
