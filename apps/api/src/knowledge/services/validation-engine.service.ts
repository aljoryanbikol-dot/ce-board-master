/**
 * @file validation-engine.service.ts
 * @module Knowledge/Services
 *
 * ValidationEngineService — validates knowledge entities against the governing
 * specification (Books 11–13). This is the machine enforcement of the rules the
 * documents mandate: ID format, valid subject/category/type codes, sequence
 * within reserved ranges, and required references.
 *
 * Pure: each method returns a ValidationResult (no throw, no DB) so callers can
 * collect issues, surface them in bulk, or gate publication. The owning service
 * decides whether to reject. No DB access here.
 */
import { Injectable } from '@nestjs/common';
import { PublicIdService } from './public-id.service';
import {
  SUBJECT_CODES, BLUEPRINT_TYPE_CODES, MISCONCEPTION_CATEGORY_CODES,
  SEMVER_PATTERN, LO_NUMBER_RANGES,
} from '../constants/knowledge.constants';
import type { ValidationIssue, ValidationResult } from '../types/knowledge.types';

@Injectable()
export class ValidationEngineService {
  constructor(private readonly publicId: PublicIdService) {}

  validateLearningObjective(input: {
    publicId: string; subjectCode: string; statement: string; bloomLevel: string;
    semver: string; sequenceNumber: number;
  }): ValidationResult {
    const issues: ValidationIssue[] = [];
    if (!this.publicId.validateLearningObjectiveId(input.publicId)) {
      issues.push(this.err('publicId', `LO ID must match LO-<Subj>-<Topic>-<Subtopic>-<Number> (got '${input.publicId}').`));
    }
    if (!Object.prototype.hasOwnProperty.call(SUBJECT_CODES, input.subjectCode)) {
      issues.push(this.err('subjectCode', `Unknown subject code '${input.subjectCode}'.`));
    }
    if (!input.statement || input.statement.trim().length < 10) {
      issues.push(this.err('statement', 'A Learning Objective statement must be at least 10 characters and measurable.'));
    }
    if (!SEMVER_PATTERN.test(input.semver)) {
      issues.push(this.err('semver', `Version must be semantic (Major.Minor.Patch); got '${input.semver}'.`));
    }
    this.checkSequenceRange(input.sequenceNumber, issues);
    return this.result(issues);
  }

  validateBlueprint(input: {
    publicId: string; subjectCode: string; blueprintType: string; name: string; semver: string;
  }): ValidationResult {
    const issues: ValidationIssue[] = [];
    if (!this.publicId.validateBlueprintId(input.publicId)) {
      issues.push(this.err('publicId', `Blueprint ID must match BP-<Subj>-<Topic>-<Subtopic>-<Type>-<Number> (got '${input.publicId}').`));
    }
    if (!Object.prototype.hasOwnProperty.call(SUBJECT_CODES, input.subjectCode)) {
      issues.push(this.err('subjectCode', `Unknown subject code '${input.subjectCode}'.`));
    }
    if (!Object.prototype.hasOwnProperty.call(BLUEPRINT_TYPE_CODES, input.blueprintType)) {
      issues.push(this.err('blueprintType', `Unknown blueprint type '${input.blueprintType}'.`));
    }
    if (!input.name || input.name.trim().length < 3) {
      issues.push(this.err('name', 'Blueprint name is required.'));
    }
    if (!SEMVER_PATTERN.test(input.semver)) {
      issues.push(this.err('semver', `Version must be semantic; got '${input.semver}'.`));
    }
    return this.result(issues);
  }

  validateMisconception(input: {
    publicId: string; subjectCode: string; category: string; title: string; description: string; semver: string;
  }): ValidationResult {
    const issues: ValidationIssue[] = [];
    if (!this.publicId.validateMisconceptionId(input.publicId)) {
      issues.push(this.err('publicId', `Misconception ID must match MC-<Subj>-<Topic>-<Subtopic>-<Category>-<Number> (got '${input.publicId}').`));
    }
    if (!Object.prototype.hasOwnProperty.call(SUBJECT_CODES, input.subjectCode)) {
      issues.push(this.err('subjectCode', `Unknown subject code '${input.subjectCode}'.`));
    }
    if (!Object.prototype.hasOwnProperty.call(MISCONCEPTION_CATEGORY_CODES, input.category)) {
      issues.push(this.err('category', `Unknown misconception category '${input.category}'.`));
    }
    if (!input.title || input.title.trim().length < 3) {
      issues.push(this.err('title', 'Misconception title is required.'));
    }
    if (!input.description || input.description.trim().length < 10) {
      issues.push(this.err('description', 'Misconception description must be at least 10 characters.'));
    }
    if (!SEMVER_PATTERN.test(input.semver)) {
      issues.push(this.err('semver', `Version must be semantic; got '${input.semver}'.`));
    }
    return this.result(issues);
  }

  validateFormulaId(formulaId: string): ValidationResult {
    const issues: ValidationIssue[] = [];
    if (!this.publicId.validateFormulaId(formulaId)) {
      issues.push(this.err('formulaId', `Formula ID must match [Subject]-F-#### (got '${formulaId}').`));
    }
    return this.result(issues);
  }

  private checkSequenceRange(seq: number, issues: ValidationIssue[]): void {
    const inRange = Object.values(LO_NUMBER_RANGES).some((r) => seq >= r.min && seq <= r.max);
    if (!inRange) {
      issues.push({ code: 'SEQUENCE_OUT_OF_RANGE', field: 'sequenceNumber', severity: 'warning', message: `Sequence ${seq} falls outside the reserved ranges (1–999).` });
    }
  }

  private err(field: string, message: string): ValidationIssue {
    return { code: 'VALIDATION_ERROR', field, message, severity: 'error' };
  }

  private result(issues: ValidationIssue[]): ValidationResult {
    return { valid: !issues.some((i) => i.severity === 'error'), issues };
  }
}
