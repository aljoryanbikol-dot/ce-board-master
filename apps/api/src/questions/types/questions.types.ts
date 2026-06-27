/**
 * @file questions.types.ts
 * @module Questions/Types
 */
import type { ReviewStage } from '../constants/questions.constants';

/** A single answer choice as returned by the API. */
export interface ChoiceView {
  letter:      string;
  text:        string;
  latex:       string | null;
  html:        string | null;
  isCorrect:   boolean;
  explanation: string | null;
  sortOrder:   number;
}

/** Compact question representation for list/search results. */
export interface QuestionSummary {
  id:            string;
  questionCode:  string;
  subjectId:     string;
  topicId:       string;
  subtopicId:    string;
  difficultyLevelId: string;
  stemText:      string;
  status:        string;
  bloomLevel:    string;
  questionType:  string;
  authorId:      string;
  reviewerId:    string | null;
  currentVersion: number;
  isAiGenerated: boolean;
  publishedAt:   string | null;
  createdAt:     string;
  updatedAt:     string;
  tags:          string[];
}

/** Full question detail. */
export interface QuestionDetail extends QuestionSummary {
  stemLatex:         string | null;
  stemHtml:          string | null;
  correctChoice:     string;
  explanationText:   string;
  explanationLatex:  string | null;
  explanationHtml:   string | null;
  learningObjective: string | null;
  prcSyllabusRef:    string | null;
  estSolvingTimeSec: number;
  language:          string;
  publishedBy:       string | null;
  isPrcVerified:     boolean;
  choices:           ChoiceView[];
  /** Current review stage when status is in_review, else null. */
  reviewStage:       ReviewStage | null;
}

/** Cursor-paginated list result. */
export interface QuestionListResult {
  data: QuestionSummary[];
  pagination: { cursor: string | null; hasMore: boolean; total: number };
}

/** A single workflow/transition log entry. */
export interface WorkflowEntry {
  id:           string;
  versionNumber: number | null;
  fromStatus:   string | null;
  toStatus:     string;
  actionType:   string;
  actionBy:     string;
  notes:        string | null;
  occurredAt:   string;
}

/** A version history entry. */
export interface VersionEntry {
  id:            string;
  versionNumber: number;
  changeType:    string;
  changeSummary: string | null;
  changedBy:     string;
  reviewedBy:    string | null;
  isCurrent:     boolean;
  createdAt:     string;
}

/** The content snapshot persisted into QuestionVersion.contentSnapshot. */
export interface VersionSnapshot {
  stemText:          string;
  stemLatex:         string | null;
  stemHtml:          string | null;
  correctChoice:     string;
  explanationText:   string;
  explanationLatex:  string | null;
  explanationHtml:   string | null;
  bloomLevel:        string;
  questionType:      string;
  learningObjective: string | null;
  difficultyLevelId: string;
  subjectId:         string;
  topicId:           string;
  subtopicId:        string;
  choices:           ChoiceView[];
  reviewStage:       ReviewStage | null;
}
