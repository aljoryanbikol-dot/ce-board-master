/**
 * @file cms.types.ts
 * @module Cms/Types
 */

export interface LockView {
  id:         string;
  questionId: string;
  lockedBy:   string;
  reason:     string | null;
  acquiredAt: string;
  expiresAt:  string;
  isActive:   boolean;
}

export interface AssignmentView {
  id:          string;
  questionId:  string;
  assigneeId:  string;
  assignedBy:  string;
  stage:       string;
  status:      string;
  dueAt:       string | null;
  assignedAt:  string;
  completedAt: string | null;
}

export interface CommentView {
  id:         string;
  questionId: string;
  authorId:   string;
  parentId:   string | null;
  stage:      string | null;
  body:       string;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt:  string;
  replies?:   CommentView[];
}

export interface EditorialNoteView {
  id:         string;
  questionId: string;
  authorId:   string;
  category:   string;
  body:       string;
  isPinned:   boolean;
  createdAt:  string;
  updatedAt:  string;
}

export interface ActivityEntry {
  type:       string;     // 'workflow' | 'comment' | 'assignment' | 'lock' | 'note'
  questionId: string;
  actorId:    string;
  summary:    string;
  occurredAt: string;
  meta?:      Record<string, unknown>;
}

export interface BulkOperationResult {
  operation:  string;
  total:      number;
  succeeded:  number;
  failed:     number;
  errors:     { questionId: string; code: string; message: string }[];
}
