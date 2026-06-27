/**
 * @file exam.types.ts
 * @module Exams/Types
 */

/** A single entry in an exam template's composition blueprint. */
export interface CompositionEntry {
  subjectId: string;
  count: number;
  difficultyLevelId?: string;
  weightPercent?: number;
}

/** The presented form of an exam question (choices already randomized). */
export interface PresentedQuestion {
  examQuestionId: string;
  position: number;
  questionId: string;
  stemText: string;
  choices: { letter: string; text: string }[]; // presented letters A.. in shuffled order
  state: string;
  selectedChoice: string | null; // presented letter the student picked
  isBookmarked: boolean;
}

export interface ExamTimerState {
  status: string;
  durationMinutes: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  expiresAt: string | null;
  expired: boolean;
}

export interface SubjectScore {
  subjectId: string;
  total: number;
  correct: number;
  scorePercent: number;
  weightPercent: number | null;
}

export interface TopicScore {
  subjectId: string;
  topicId: string;
  total: number;
  correct: number;
  scorePercent: number;
}

export interface ScoreBreakdown {
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  scorePercent: number;
  passingScore: number;
  passed: boolean;
  timeSpentSec: number;
  bySubject: SubjectScore[];
  byTopic: TopicScore[];
}

export interface ExamResultView {
  resultCode: string;
  examId: string;
  status: string;
  scorePercent: number;
  passingScore: number;
  passed: boolean;
  percentile: number | null;
  breakdown: ScoreBreakdown;
  computedAt: string;
}

export interface WeaknessStrength {
  weaknesses: { subjectId: string; topicId?: string; scorePercent: number }[];
  strengths: { subjectId: string; topicId?: string; scorePercent: number }[];
}

/** A built exam question prior to persistence (internal). */
export interface BuiltExamQuestion {
  questionId: string;
  position: number;
  subjectId: string;
  topicId: string | null;
  difficultyLevelId: string | null;
  learningObjective: string | null;
  choiceOrder: string[]; // presented[i] -> original letter
  correctChoice: string; // original letter
}
