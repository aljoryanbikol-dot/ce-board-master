/**
 * @file explanation.service.ts
 * @module AITutor/Services
 *
 * ExplanationService — concept and question explanations grounded in the
 * Knowledge Base. It assembles context, asks the provider to compose an answer,
 * attaches citations (LO / formula / misconception), runs a lightweight grounding
 * validation, and returns the result. Reused by AITutorService for the
 * explain_concept and explain_question intents.
 */
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TutorContextService } from './tutor-context.service';
import { GroundingValidationService } from './grounding-validation.service';
import { TUTOR_PROVIDER, type TutorProvider } from '../providers/tutor-provider.interface';
import { TutorErrors } from '../errors/tutor.errors';
import { EVENTS } from '../../common/constants';
import type { ExplanationResult } from '../types/tutor.types';

@Injectable()
export class ExplanationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TutorContextService,
    private readonly grounding: GroundingValidationService,
    @Inject(TUTOR_PROVIDER) private readonly provider: TutorProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async explainConcept(concept: string, opts: { subjectId?: string; topicId?: string }): Promise<ExplanationResult> {
    const ctx = await this.context.build({ subjectId: opts.subjectId ?? null, topicId: opts.topicId ?? null });
    const out = await this.provider.respond({ intent: 'explain_concept', prompt: concept, context: ctx });
    const citations = this.context.citationsFromContext(ctx);
    const validatedOk = this.grounding.validate(out.content, ctx).ok;
    this.eventEmitter.emit(EVENTS.TUTOR_RESPONSE_VALIDATED, { intent: 'explain_concept', validatedOk });
    return { content: out.content, citations, groundedInKb: citations.length > 0, followUps: out.followUps };
  }

  async explainQuestion(questionId: string): Promise<ExplanationResult & { questionId: string }> {
    const question = await this.loadPublished(questionId);
    const ctx = await this.context.build({ subjectId: question.subjectId, topicId: question.topicId });
    const out = await this.provider.respond({
      intent: 'explain_question', prompt: question.stemText, context: ctx,
      questionContext: { stemText: question.stemText, correctChoice: question.correctChoice, explanationText: question.explanationText },
    });
    const citations = this.context.citationsFromContext(ctx);
    citations.push({ kind: 'question', refId: question.id, label: `Question ${question.questionCode ?? question.id}` });
    return { questionId, content: out.content, citations, groundedInKb: true, followUps: out.followUps };
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
