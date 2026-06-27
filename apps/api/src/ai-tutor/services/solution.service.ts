/**
 * @file solution.service.ts
 * @module AITutor/Services
 *
 * SolutionService — step-by-step worked solutions for a published question. It
 * grounds in the topic context, asks the provider to produce ordered steps, and
 * attaches formula/LO citations. This is the "reveal" complement to HintService.
 */
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { TutorContextService } from './tutor-context.service';
import { TUTOR_PROVIDER, type TutorProvider } from '../providers/tutor-provider.interface';
import { TutorErrors } from '../errors/tutor.errors';
import { EVENTS } from '../../common/constants';
import type { SolutionResult, SolutionStep } from '../types/tutor.types';

@Injectable()
export class SolutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TutorContextService,
    @Inject(TUTOR_PROVIDER) private readonly provider: TutorProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async solve(userId: string, questionId: string): Promise<SolutionResult> {
    const question = await this.loadPublished(questionId);
    const ctx = await this.context.build({ subjectId: question.subjectId, topicId: question.topicId });

    const out = await this.provider.solve({
      stemText: question.stemText, correctChoice: question.correctChoice, explanationText: question.explanationText, context: ctx,
    });

    const steps: SolutionStep[] = out.steps.map((text, i) => ({ order: i + 1, text, formulaRef: ctx.formulas[0]?.id }));
    const citations = this.context.citationsFromContext(ctx);
    citations.push({ kind: 'question', refId: question.id, label: `Question ${question.questionCode ?? question.id}` });

    this.eventEmitter.emit(EVENTS.TUTOR_SOLUTION_GIVEN, { userId, questionId, steps: steps.length });
    return { questionId, steps, finalAnswer: out.finalAnswer, citations, groundedInKb: ctx.formulas.length > 0 || ctx.learningObjectives.length > 0 };
  }

  private async loadPublished(questionId: string) {
    const q = await this.prisma.question.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { id: true, questionCode: true, subjectId: true, topicId: true, stemText: true, correctChoice: true, explanationText: true, questionStatus: true },
    });
    if (!q) throw TutorErrors.questionNotFound(questionId);
    if (q.questionStatus !== 'published') throw TutorErrors.questionNotAvailable(questionId);
    return q;
  }
}
