/**
 * @file hint.service.ts
 * @module AITutor/Services
 *
 * HintService — progressive, graded hints for a specific published question. It
 * escalates across three levels (nudge → direction → near-answer) and never
 * reveals the final answer. Grounded in the topic's Knowledge Base context.
 */
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { TutorContextService } from './tutor-context.service';
import { TUTOR_PROVIDER, type TutorProvider } from '../providers/tutor-provider.interface';
import { TutorErrors } from '../errors/tutor.errors';
import { EVENTS } from '../../common/constants';
import { HINT_LEVELS, TUTOR_LIMITS } from '../constants/tutor.constants';
import type { HintResult } from '../types/tutor.types';

@Injectable()
export class HintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TutorContextService,
    @Inject(TUTOR_PROVIDER) private readonly provider: TutorProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async hint(userId: string, questionId: string, requestedLevel?: number): Promise<HintResult> {
    const level = Math.min(Math.max(requestedLevel ?? HINT_LEVELS.NUDGE, 1), TUTOR_LIMITS.MAX_HINTS_PER_QUESTION);
    const question = await this.loadPublished(questionId);
    const ctx = await this.context.build({ subjectId: question.subjectId, topicId: question.topicId });

    const out = await this.provider.respond({
      intent: 'hint', prompt: question.stemText, context: ctx, hintLevel: level,
      questionContext: { stemText: question.stemText, correctChoice: question.correctChoice, explanationText: question.explanationText },
    });

    const citations = this.context.citationsFromContext(ctx).filter((c) => c.kind !== 'question').slice(0, 2);
    this.eventEmitter.emit(EVENTS.TUTOR_HINT_GIVEN, { userId, questionId, level });
    return { level, hint: out.content, nextLevelAvailable: level < TUTOR_LIMITS.MAX_HINTS_PER_QUESTION, citations };
  }

  private async loadPublished(questionId: string) {
    const q = await this.prisma.question.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { id: true, subjectId: true, topicId: true, stemText: true, correctChoice: true, explanationText: true, questionStatus: true },
    });
    if (!q) throw TutorErrors.questionNotFound(questionId);
    if (q.questionStatus !== 'published') throw TutorErrors.questionNotAvailable(questionId);
    return q;
  }
}
