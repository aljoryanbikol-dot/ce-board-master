/**
 * @file knowledge.types.ts
 * @module Knowledge/Types
 */

export interface ParsedSection {
  anchor:    string;
  heading:   string;
  level:     number;
  orderIndex: number;
  bodyText:  string;
  wordCount: number;
}

export interface ParsedDocument {
  contentText:   string;
  contentChecksum: string;
  wordCount:     number;
  sections:      ParsedSection[];
}

export interface KnowledgeDocumentView {
  id:             string;
  bookNumber:     number;
  documentType:   string;
  title:          string;
  slug:           string;
  description:    string | null;
  status:         string;
  currentVersion: number;
  latestSemver:   string;
  ownerTeam:      string | null;
  createdAt:      string;
  updatedAt:      string;
}

export interface DocumentVersionView {
  id:            string;
  documentId:    string;
  versionNumber: number;
  semver:        string;
  status:        string;
  contentChecksum: string;
  sectionCount:  number;
  wordCount:     number;
  changeSummary: string | null;
  isCurrent:     boolean;
  publishedAt:   string | null;
  createdAt:     string;
}

export interface ValidationIssue {
  code:     string;
  field:    string;
  message:  string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid:    boolean;
  issues:   ValidationIssue[];
}

export interface CrossReferenceView {
  id:           string;
  referenceType: string;
  fromType:     string;
  fromId:       string;
  fromPublicId: string | null;
  toType:       string;
  toId:         string;
  toPublicId:   string | null;
  weight:       number;
  note:         string | null;
  createdAt:    string;
}

export interface GraphNode {
  id:       string;
  type:     string;
  publicId: string | null;
  label:    string;
}

export interface GraphEdge {
  from:          string;
  to:            string;
  referenceType: string;
  weight:        number;
}

export interface DependencyGraph {
  rootId: string;
  nodes:  GraphNode[];
  edges:  GraphEdge[];
  depth:  number;
}

export interface SearchHit {
  type:      string;       // 'document' | 'section' | 'learning_objective' | 'formula' | 'blueprint' | 'misconception'
  id:        string;
  publicId:  string | null;
  title:     string;
  snippet:   string;
  score:     number;
}

export interface ParsedPublicId {
  prefix:       string;
  subjectCode:  string;
  topicCode:    string;
  subtopicCode: string;
  qualifier:    string | null; // blueprint type or misconception category
  sequence:     number;
}
