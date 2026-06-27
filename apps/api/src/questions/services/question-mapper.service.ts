/**
 * @file question-mapper.service.ts
 * @module Questions/Services
 *
 * Pure mapping helpers: Prisma rows → API DTOs, and content → version snapshot.
 * Extracted into its own injectable so every question service shares one
 * mapping definition (DRY) and the mapping logic is independently testable.
 *
 * No DB access, no side effects.
 */
import { Injectable } from '@nestjs/common';
import type {
  ChoiceView,
  QuestionSummary,
  QuestionDetail,
  VersionSnapshot,
} from '../types/questions.types';
import type { ReviewStage } from '../constants/questions.constants';

// Row shapes (subset of Prisma selections this mapper consumes)
interface ChoiceRow {
  choiceLetter: string;
  choiceText:   string;
  choiceLatex:  string | null;
  choiceHtml:   string | null;
  isCorrect:    boolean;
  explanation:  string | null;
  sortOrder:    number;
}

interface QuestionRow {
  id: string; questionCode: string; subjectId: string; topicId: string;
  subtopicId: string; difficultyLevelId: string; stemText: string;
  stemLatex: string | null; stemHtml: string | null; correctChoice: string;
  explanationText: string; explanationLatex: string | null; explanationHtml: string | null;
  questionStatus: string; bloomLevel: string; questionType: string;
  learningObjective: string | null; prcSyllabusRef: string | null;
  estSolvingTimeSec: number; language: string;
  authorId: string; reviewerId: string | null; publishedBy: string | null;
  currentVersion: number; isPrcVerified: boolean; isAiGenerated: boolean;
  publishedAt: Date | null; createdAt: Date; updatedAt: Date;
  choices?: ChoiceRow[];
  questionTags?: { tagId: string }[];
}

@Injectable()
export class QuestionMapperService {
  toChoiceView(c: ChoiceRow): ChoiceView {
    return {
      letter:      c.choiceLetter,
      text:        c.choiceText,
      latex:       c.choiceLatex,
      html:        c.choiceHtml,
      isCorrect:   c.isCorrect,
      explanation: c.explanation,
      sortOrder:   c.sortOrder,
    };
  }

  toSummary(q: QuestionRow, tags: string[] = []): QuestionSummary {
    return {
      id:            q.id,
      questionCode:  q.questionCode,
      subjectId:     q.subjectId,
      topicId:       q.topicId,
      subtopicId:    q.subtopicId,
      difficultyLevelId: q.difficultyLevelId,
      stemText:      q.stemText,
      status:        q.questionStatus,
      bloomLevel:    q.bloomLevel,
      questionType:  q.questionType,
      authorId:      q.authorId,
      reviewerId:    q.reviewerId,
      currentVersion: q.currentVersion,
      isAiGenerated: q.isAiGenerated,
      publishedAt:   q.publishedAt?.toISOString() ?? null,
      createdAt:     q.createdAt.toISOString(),
      updatedAt:     q.updatedAt.toISOString(),
      tags,
    };
  }

  toDetail(q: QuestionRow, reviewStage: ReviewStage | null): QuestionDetail {
    const tags = (q.questionTags ?? []).map((t) => t.tagId);
    return {
      ...this.toSummary(q, tags),
      stemLatex:         q.stemLatex,
      stemHtml:          q.stemHtml,
      correctChoice:     q.correctChoice,
      explanationText:   q.explanationText,
      explanationLatex:  q.explanationLatex,
      explanationHtml:   q.explanationHtml,
      learningObjective: q.learningObjective,
      prcSyllabusRef:    q.prcSyllabusRef,
      estSolvingTimeSec: q.estSolvingTimeSec,
      language:          q.language,
      publishedBy:       q.publishedBy,
      isPrcVerified:     q.isPrcVerified,
      choices:           (q.choices ?? []).map((c) => this.toChoiceView(c)).sort((a, b) => a.letter.localeCompare(b.letter)),
      reviewStage,
    };
  }

  /** Build the immutable content snapshot stored in QuestionVersion. */
  buildSnapshot(q: QuestionRow, reviewStage: ReviewStage | null): VersionSnapshot {
    return {
      stemText:          q.stemText,
      stemLatex:         q.stemLatex,
      stemHtml:          q.stemHtml,
      correctChoice:     q.correctChoice,
      explanationText:   q.explanationText,
      explanationLatex:  q.explanationLatex,
      explanationHtml:   q.explanationHtml,
      bloomLevel:        q.bloomLevel,
      questionType:      q.questionType,
      learningObjective: q.learningObjective,
      difficultyLevelId: q.difficultyLevelId,
      subjectId:         q.subjectId,
      topicId:           q.topicId,
      subtopicId:        q.subtopicId,
      choices:           (q.choices ?? []).map((c) => this.toChoiceView(c)),
      reviewStage,
    };
  }
}
