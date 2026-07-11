/**
 * @file exam-review.service.ts
 * @module Exams/Services
 *
 * ExamReviewService — premium post-exam Review Mode. Returns the questions of
 * a submitted exam filtered by all / incorrect / bookmarked / skipped with the
 * full engineering context for each: the student's answer vs the correct one,
 * the step-by-step solution, formulas used (with LaTeX), engineering notes and
 * the AI-tutor explanation, common mistakes, board tips, and the question's
 * figure. Ownership-scoped; only available once the exam is submitted/expired.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { QuestionDiagramLookupService } from '../../questions/services/question-diagram-lookup.service';
import { ExamErrors } from '../errors/exam.errors';
import type { ReviewQueryDto } from '../dto/exam.dto';

/**
 * examineerNotes stores the Knowledge Library engineering notes and the
 * AI-tutor explanation folded into one field, joined by an "AI Tutor:" marker
 * (see kb-migrate.ts question import). Split them back for display.
 */
function splitNotes(examineerNotes: string | null | undefined): { engineeringNotes: string | null; aiTutorExplanation: string | null } {
  if (!examineerNotes) return { engineeringNotes: null, aiTutorExplanation: null };
  const marker = '\n\nAI Tutor: ';
  const at = examineerNotes.indexOf(marker);
  if (at < 0) return { engineeringNotes: examineerNotes, aiTutorExplanation: null };
  return {
    engineeringNotes: examineerNotes.slice(0, at) || null,
    aiTutorExplanation: examineerNotes.slice(at + marker.length) || null,
  };
}

@Injectable()
export class ExamReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagrams: QuestionDiagramLookupService,
  ) {}

  async review(userId: string, examId: string, dto: ReviewQueryDto) {
    const exam = await this.prisma.mockExam.findUnique({ where: { id: examId } });
    if (!exam) throw ExamErrors.examNotFound(examId);
    if (exam.userId !== userId) throw ExamErrors.examForbidden();
    if (exam.status !== 'submitted' && exam.status !== 'expired') throw ExamErrors.resultNotReady();

    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId }, orderBy: { position: 'asc' },
      include: {
        answer: true,
        question: {
          select: {
            questionCode: true, stemText: true, correctChoice: true, explanationText: true,
            situationOrder: true,
            situation: { select: { id: true, publicId: true, situationText: true, givenData: true, figurePublicId: true, category: true } },
            choices: { select: { choiceLetter: true, choiceText: true } },
            subject: { select: { name: true, code: true } },
            topic: { select: { name: true } },
            intelligence: { select: { examineerNotes: true, commonMistakes: true, studyTips: true, timeSavingTips: true } },
            questionFormulas: {
              select: {
                isPrimary: true,
                formula: { select: { name: true, slug: true, expressionLatex: true, expressionText: true } },
              },
              orderBy: { isPrimary: 'desc' },
            },
          },
        },
      },
    });

    // Batch-resolve every question's figure by naming convention (one query).
    const codes = examQuestions.map((eq: any) => eq.question.questionCode as string);
    const figureByCode = await this.diagrams.resolveMany(codes);

    // Situational context: number situations in exam order, count members,
    // resolve shared situation figures — Review Mode shows the scenario once
    // per linked set alongside the shared formulas/notes of each question.
    const sitNumbers = new Map<string, number>();
    const sitCounts = new Map<string, number>();
    for (const eq of examQuestions as any[]) {
      const sit = eq.question.situation;
      if (!sit) continue;
      if (!sitNumbers.has(sit.id)) sitNumbers.set(sit.id, sitNumbers.size + 1);
      sitCounts.set(sit.id, (sitCounts.get(sit.id) ?? 0) + 1);
    }
    const sitFigIds = [...new Set((examQuestions as any[]).map((eq) => eq.question.situation?.figurePublicId).filter(Boolean))] as string[];
    const sitFigures = sitFigIds.length
      ? new Map((await this.prisma.diagram.findMany({ where: { publicId: { in: sitFigIds } }, select: { publicId: true, imageUrl: true, title: true, altText: true } })).map((d) => [d.publicId, d]))
      : new Map();
    const sitRunning = new Map<string, number>();

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
        const { engineeringNotes, aiTutorExplanation } = splitNotes(eq.question.intelligence?.examineerNotes);
        const commonMistakes = Array.isArray(eq.question.intelligence?.commonMistakes)
          ? (eq.question.intelligence.commonMistakes as string[])
          : [];
        return {
          examQuestionId: eq.id, position: eq.position, questionId: eq.questionId, stemText: eq.question.stemText,
          subjectName: eq.question.subject?.name ?? null,
          topicName: eq.question.topic?.name ?? null,
          choices: order.map((orig, i) => ({ letter: String.fromCharCode(65 + i), text: choiceMap.get(orig) ?? '', isCorrect: orig === eq.correctChoice })),
          selectedChoice: eq.answer?.selectedChoice ?? null,
          correctChoicePresented: order.indexOf(eq.correctChoice) >= 0 ? String.fromCharCode(65 + order.indexOf(eq.correctChoice)) : null,
          isCorrect: eq.answer?.isCorrect ?? null,
          isBookmarked: eq.answer?.isBookmarked ?? false,
          wasAnswered: !!eq.answer?.selectedChoice,
          timeSpentSec: eq.answer?.timeSpentSec ?? null,
          // Full engineering context for premium Review Mode.
          explanation: eq.question.explanationText,
          engineeringNotes,
          aiTutorExplanation,
          commonMistakes,
          boardTips: (eq.question.intelligence?.studyTips as string[] | undefined) ?? [],
          timeSavingTips: eq.question.intelligence?.timeSavingTips ?? null,
          formulas: (eq.question.questionFormulas as any[]).map((f) => ({
            name: f.formula.name, slug: f.formula.slug,
            latex: f.formula.expressionLatex, text: f.formula.expressionText,
            isPrimary: f.isPrimary,
          })),
          diagram: figureByCode.get(eq.question.questionCode) ?? null,
          situation: (() => {
            const sit = eq.question.situation;
            if (!sit) return null;
            const idx = (sitRunning.get(sit.id) ?? 0) + 1;
            sitRunning.set(sit.id, idx);
            const fig = sit.figurePublicId ? sitFigures.get(sit.figurePublicId) ?? null : null;
            return {
              publicId: sit.publicId, number: sitNumbers.get(sit.id) ?? 1,
              text: sit.situationText, givenData: sit.givenData ?? null, category: sit.category ?? null,
              questionIndex: eq.question.situationOrder ?? idx, questionCount: sitCounts.get(sit.id) ?? 1,
              figure: fig ? { imageUrl: fig.imageUrl, title: fig.title, altText: fig.altText } : null,
            };
          })(),
        };
      });

    return { examId, filter: dto.filter, count: items.length, items };
  }
}
