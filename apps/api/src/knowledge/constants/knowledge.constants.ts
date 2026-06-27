/**
 * @file knowledge.constants.ts
 * @module Knowledge
 *
 * Constants derived from the official enterprise specification (Books 1–15).
 * These encode the immutable identifier formats, subject/category codes, and
 * validation rules the documents mandate. They are the machine-readable form of
 * the governing standard — every knowledge entity validates against them.
 */

// ── Error codes ───────────────────────────────────────────────────────────────

export const KNOWLEDGE_ERROR_CODES = {
  DOCUMENT_NOT_FOUND:       'DOCUMENT_NOT_FOUND',
  DOCUMENT_BOOK_TAKEN:      'DOCUMENT_BOOK_TAKEN',
  VERSION_NOT_FOUND:        'VERSION_NOT_FOUND',
  DUPLICATE_CONTENT:        'DUPLICATE_CONTENT',
  ENTITY_NOT_FOUND:         'ENTITY_NOT_FOUND',
  PUBLIC_ID_TAKEN:          'PUBLIC_ID_TAKEN',
  INVALID_PUBLIC_ID:        'INVALID_PUBLIC_ID',
  INVALID_SUBJECT_CODE:     'INVALID_SUBJECT_CODE',
  INVALID_CATEGORY_CODE:    'INVALID_CATEGORY_CODE',
  INVALID_BLUEPRINT_TYPE:   'INVALID_BLUEPRINT_TYPE',
  VALIDATION_FAILED:        'VALIDATION_FAILED',
  CROSS_REFERENCE_EXISTS:   'CROSS_REFERENCE_EXISTS',
  CROSS_REFERENCE_NOT_FOUND:'CROSS_REFERENCE_NOT_FOUND',
  CYCLE_DETECTED:           'CYCLE_DETECTED',
  NOT_PUBLISHABLE:          'NOT_PUBLISHABLE',
  FORBIDDEN_KNOWLEDGE:      'FORBIDDEN_KNOWLEDGE',
} as const;

export type KnowledgeErrorCode =
  (typeof KNOWLEDGE_ERROR_CODES)[keyof typeof KNOWLEDGE_ERROR_CODES];

// ── Subject codes (Book 11 §4.3 — permanent three-letter codes) ────────────────

export const SUBJECT_CODES = {
  MTH: 'Mathematics',
  SUR: 'Surveying',
  STR: 'Structural Engineering',
  RCD: 'Reinforced Concrete',
  STL: 'Steel Design',
  HYD: 'Hydraulics',
  HYG: 'Hydrology',
  GEO: 'Geotechnical Engineering',
  TRN: 'Transportation Engineering',
  CON: 'Construction Engineering',
  ECO: 'Engineering Economics',
  LAW: 'Engineering Laws & Ethics',
} as const;

export type SubjectCode = keyof typeof SUBJECT_CODES;

/** Short subject codes used by the Formula ID format ([Subject]-F-####). */
export const FORMULA_SUBJECT_CODES = ['M', 'ST', 'HY', 'GT', 'TR', 'CM', 'ES', 'SU', 'RC', 'SL', 'HG', 'EC', 'LW'] as const;

// ── Blueprint type codes (Book 12 §4.3) ────────────────────────────────────────

export const BLUEPRINT_TYPE_CODES = {
  CON: 'Conceptual',
  CMP: 'Computational',
  SCN: 'Scenario-Based',
  DIA: 'Diagram-Based',
  MUL: 'Multi-Step',
  CAS: 'Case Study',
  DSG: 'Design',
  BRD: 'Board Simulation',
} as const;

export type BlueprintTypeCode = keyof typeof BLUEPRINT_TYPE_CODES;

// ── Misconception category codes (Book 13 §4.3) ────────────────────────────────

export const MISCONCEPTION_CATEGORY_CODES = {
  CON: 'Conceptual Error',
  FRM: 'Formula Error',
  CMP: 'Computational Error',
  UNT: 'Unit Conversion Error',
  DIA: 'Diagram Error',
  ENG: 'Engineering Judgment Error',
  ASM: 'Assumption Error',
  INT: 'Interpretation Error',
  COD: 'Code Application Error',
} as const;

export type MisconceptionCategoryCode = keyof typeof MISCONCEPTION_CATEGORY_CODES;

// ── LO reserved number ranges (Book 11 §4.5) ───────────────────────────────────

export const LO_NUMBER_RANGES = {
  STANDARD:     { min: 1,   max: 499, label: 'Standard Learning Objectives' },
  ADVANCED:     { min: 500, max: 699, label: 'Advanced Learning Objectives' },
  AI_GENERATED: { min: 700, max: 799, label: 'AI-generated Learning Objectives' },
  LEGACY:       { min: 800, max: 899, label: 'Legacy Objectives' },
  EXPERIMENTAL: { min: 900, max: 999, label: 'Experimental Objectives' },
} as const;

// ── Identifier formats (regex, per the governing books) ────────────────────────

/** LO-<Subject>-<Topic>-<Subtopic>-<Number>  e.g. LO-STR-001-003-001 */
export const LO_ID_PATTERN = /^LO-[A-Z]{3}-\d{3}-\d{3}-\d{3}$/;
/** BP-<Subject>-<Topic>-<Subtopic>-<Type>-<Number>  e.g. BP-STR-004-002-CMP-001 */
export const BLUEPRINT_ID_PATTERN = /^BP-[A-Z]{3}-\d{3}-\d{3}-[A-Z]{3}-\d{3}$/;
/** MC-<Subject>-<Topic>-<Subtopic>-<Category>-<Number>  e.g. MC-STR-003-002-FRM-001 */
export const MISCONCEPTION_ID_PATTERN = /^MC-[A-Z]{3}-\d{3}-\d{3}-[A-Z]{3}-\d{3}$/;
/** [Subject]-F-####  e.g. ST-F-0015 */
export const FORMULA_ID_PATTERN = /^[A-Z]{1,2}-F-\d{4}$/;
/** Semantic version Major.Minor.Patch */
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

// ── Document type ↔ book number mapping (Books 1–15) ───────────────────────────

export const BOOK_DOCUMENT_TYPES = {
  1:  'authoring_bible',
  2:  'knowledge_map',
  3:  'question_writing_standards',
  4:  'formula_library',
  5:  'engineering_codes',
  6:  'question_templates',
  7:  'distractor_design',
  8:  'explanation_standards',
  9:  'psychometric_standards',
  10: 'ai_content_generation',
  11: 'learning_objectives',
  12: 'question_blueprints',
  13: 'misconceptions',
  14: 'diagram_standards',
  15: 'editorial_style',
} as const;

/** Books that are governance/standards documents (full-text only, no structured entities). */
export const EDITORIAL_BOOK_NUMBERS = [1, 3, 5, 6, 7, 8, 9, 10, 14, 15] as const;

// ── Cache + limits ─────────────────────────────────────────────────────────────

export const KNOWLEDGE_CACHE_PREFIX = 'knowledge:' as const;
export const KNOWLEDGE_SEARCH_LIMIT = 50 as const;
export const KNOWLEDGE_GRAPH_MAX_DEPTH = 6 as const;
export const SECTION_MIN_WORDS = 3 as const;
