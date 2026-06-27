/**
 * @file exam-review.service.ts
 * @module Exams/Services
 *
 * ExamReviewService — post-exam answer review. Returns the questions of a
 * submitted exam filtered by all / incorrect / bookmarked / skipped, with the
 * correct answer, the student's choice, and the explanation. Ownership-scoped;
 * only available once the exam is submitted/expired (graded).
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ExamErrors } from '../errors/exam.errors';
import type { ReviewQueryDto } from '../dto/exam.dto';

@Injectable()
export class ExamReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async review(userId: string, examId: string, dto: ReviewQueryDto) {
    const exam = await this.prisma.mockExam.findUnique({ where: { id: examId } });
    if (!exam) throw ExamErrors.examNotFound(examId);
    if (exam.userId !== userId) throw ExamErrors.examForbidden();
    if (exam.status !== 'submitted' && exam.status !== 'expired') throw ExamErrors.resultNotReady();

    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId }, orderBy: { position: 'asc' },
      include: { answer: true, question: { select: { stemText: true, correctChoice: true, explanationText: true, choices: { select: { choiceLetter: true, choiceText: true } } } } },
    });

    const items = examQuestions
      .filter((eq: any) => {
        switch (dto.filter) {
          case 'incorrect': return eq.answer && eq.answer.isCorrect === false;
          case 'bookmarked': return eq.answer?.isBookmarked === true;
          case 'skipped': return !eq.answer?.selectedChoice;
          default: return true;
        }
      })
      .map((eq: any) => {
        const order = eq.choiceOrder as string[];
        const choiceMap = new Map<string, string>(eq.question.choices.map((ch: any) => [ch.choiceLetter, ch.choiceText]));
        return {
          examQuestionId: eq.id, position: eq.position, questionId: eq.questionId, stemText: eq.question.stemText,
          choices: order.map((orig, i) => ({ letter: String.fromCharCode(65 + i), text: choiceMap.get(orig) ?? '', isCorrect: orig === eq.correctChoice })),
          selectedChoice: eq.answer?.selectedChoice ?? null,
          correctChoicePresented: order.indexOf(eq.correctChoice) >= 0 ? String.fromCharCode(65 + order.indexOf(eq.correctChoice)) : null,
          isCorrect: eq.answer?.isCorrect ?? null,
          isBookmarked: eq.answer?.isBookmarked ?? false,
          wasAnswered: !!eq.answer?.selectedChoice,
          explanation: eq.question.explanationText,
        };
      });

    return { examId, filter: dto.filter, count: items.length, items };
  }
}
