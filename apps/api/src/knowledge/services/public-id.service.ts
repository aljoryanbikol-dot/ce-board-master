/**
 * @file public-id.service.ts
 * @module Knowledge/Services
 *
 * PublicIdService — pure parsing/validation/generation of the governing public
 * identifiers (LO / Blueprint / Misconception / Formula). Encodes the immutable
 * formats from Books 11–13 + 4. No DB access; entirely deterministic and unit-
 * testable in isolation.
 */
import { Injectable } from '@nestjs/common';
import {
  LO_ID_PATTERN, BLUEPRINT_ID_PATTERN, MISCONCEPTION_ID_PATTERN, FORMULA_ID_PATTERN,
  SUBJECT_CODES, BLUEPRINT_TYPE_CODES, MISCONCEPTION_CATEGORY_CODES,
  type SubjectCode, type BlueprintTypeCode, type MisconceptionCategoryCode,
} from '../constants/knowledge.constants';
import type { ParsedPublicId } from '../types/knowledge.types';

@Injectable()
export class PublicIdService {
  isValidSubjectCode(code: string): code is SubjectCode {
    return Object.prototype.hasOwnProperty.call(SUBJECT_CODES, code);
  }
  isValidBlueprintType(code: string): code is BlueprintTypeCode {
    return Object.prototype.hasOwnProperty.call(BLUEPRINT_TYPE_CODES, code);
  }
  isValidMisconceptionCategory(code: string): code is MisconceptionCategoryCode {
    return Object.prototype.hasOwnProperty.call(MISCONCEPTION_CATEGORY_CODES, code);
  }

  validateLearningObjectiveId(id: string): boolean { return LO_ID_PATTERN.test(id); }
  validateBlueprintId(id: string): boolean { return BLUEPRINT_ID_PATTERN.test(id); }
  validateMisconceptionId(id: string): boolean { return MISCONCEPTION_ID_PATTERN.test(id); }
  validateFormulaId(id: string): boolean { return FORMULA_ID_PATTERN.test(id); }

  /** Parse any of the hierarchical IDs into components. Returns null if invalid. */
  parse(id: string): ParsedPublicId | null {
    const parts = id.split('-');
    if (parts[0] === 'LO' && this.validateLearningObjectiveId(id)) {
      return { prefix: 'LO', subjectCode: parts[1]!, topicCode: parts[2]!, subtopicCode: parts[3]!, qualifier: null, sequence: Number(parts[4]) };
    }
    if (parts[0] === 'BP' && this.validateBlueprintId(id)) {
      return { prefix: 'BP', subjectCode: parts[1]!, topicCode: parts[2]!, subtopicCode: parts[3]!, qualifier: parts[4]!, sequence: Number(parts[5]) };
    }
    if (parts[0] === 'MC' && this.validateMisconceptionId(id)) {
      return { prefix: 'MC', subjectCode: parts[1]!, topicCode: parts[2]!, subtopicCode: parts[3]!, qualifier: parts[4]!, sequence: Number(parts[5]) };
    }
    return null;
  }

  /** Build an LO public id from components (zero-padded). */
  buildLearningObjectiveId(subject: string, topic: number, subtopic: number, sequence: number): string {
    return `LO-${subject}-${this.pad(topic)}-${this.pad(subtopic)}-${this.pad(sequence)}`;
  }
  buildBlueprintId(subject: string, topic: number, subtopic: number, type: string, sequence: number): string {
    return `BP-${subject}-${this.pad(topic)}-${this.pad(subtopic)}-${type}-${this.pad(sequence)}`;
  }
  buildMisconceptionId(subject: string, topic: number, subtopic: number, category: string, sequence: number): string {
    return `MC-${subject}-${this.pad(topic)}-${this.pad(subtopic)}-${category}-${this.pad(sequence)}`;
  }

  private pad(n: number): string {
    return String(n).padStart(3, '0');
  }
}
