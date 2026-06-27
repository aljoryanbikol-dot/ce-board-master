/**
 * @file ai.types.ts
 * @module AI/Types
 */
import type { DifficultyBand } from '../constants/ai.constants';

/** A grounded generation context assembled from the Knowledge Base. */
export interface GenerationContext {
  learningObjective: {
    id: string; publicId: string; statement: string; bloomLevel: string; subjectCode: string;
  } | null;
  blueprint: {
    id: string; publicId: string; name: string; blueprintType: string; structure: unknown;
  } | null;
  formulas: { id: string; name: string; expressionText: string }[];
  misconceptions: { id: string; publicId: string; title: string; category: string; description: string }[];
  subjectCode: string;
  topicCode: string | null;
  difficultyBand: DifficultyBand;
}

export interface GeneratedChoice {
  letter: string;
  text: string;
  isCorrect: boolean;
  rationale?: string;        // why correct, or which misconception this distractor targets
  misconceptionId?: string;  // MC public id when the distractor encodes a misconception
}

export interface GeneratedQuestionDraft {
  stemText: string;
  choices: GeneratedChoice[];
  correctChoice: string;
  explanationText: string;
  solutionSteps: string[];
  bloomLevel: string;
  difficultyBand: DifficultyBand;
  learningObjectiveId: string | null;
  blueprintId: string | null;
  formulaIds: string[];
  misconceptionIds: string[];
  estSolvingTimeSec: number;
  variantType: 'base' | 'numerical' | 'conceptual';
  contentHash: string;
}

export interface ProviderGenerateInput {
  context: GenerationContext;
  variantType: 'base' | 'numerical' | 'conceptual';
  seed: string;
}

export interface ValidationIssue {
  code: string;
  stage: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface PipelineValidationReport {
  outcome: 'passed' | 'passed_with_warnings' | 'failed';
  issues: ValidationIssue[];
  stages: { stage: string; passed: boolean; issueCount: number }[];
}

export interface GenerationResult {
  requestId: string;
  kind: string;
  status: string;
  variants: GeneratedQuestionDraft[];
  validation: PipelineValidationReport;
}
