/**
 * @file status-machine.ts
 * @module Questions/Constants
 *
 * The question status state machine — the single source of truth for which
 * transitions are legal. Controllers and services consult this rather than
 * hard-coding allowed transitions, so the workflow rules live in one place
 * (Single Responsibility + Open/Closed).
 *
 * Status pipeline (frozen QuestionStatus enum):
 *   draft → in_review → approved → published → archived
 *                ↘ (reject) → draft
 *   flagged ↔ published (flag / unflag)
 *
 * Review STAGES (technical → educational → editorial → qa) operate WITHIN the
 * in_review status and are governed by the REVIEW_STAGE_ORDER pipeline; see
 * questions.constants.ts. Stage approval at the final stage (qa) is what
 * advances the status from in_review → approved.
 */
import { ReviewAction } from '@prisma/client';

/** The frozen QuestionStatus values, as string literals for app logic. */
export type QStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'archived'
  | 'flagged';

/** A legal transition: the action, the resulting status, and the permission. */
export interface TransitionRule {
  action:    ReviewAction;
  to:        QStatus;
  /** RBAC permission slug required to perform this transition. */
  permission: string;
  /** Human description for audit + error messages. */
  description: string;
}

/**
 * Allowed transitions keyed by current status. Permission slugs reference the
 * frozen PERM constants (questions.*). The service validates the requested
 * action against this map and throws INVALID_TRANSITION otherwise.
 */
export const TRANSITIONS: Record<QStatus, TransitionRule[]> = {
  draft: [
    { action: ReviewAction.submit, to: 'in_review', permission: 'questions.update', description: 'Submit draft for review' },
  ],
  in_review: [
    // approve at the final stage advances to `approved`; intermediate stage
    // approvals keep status in_review (handled by the service via stage logic)
    { action: ReviewAction.approve,         to: 'approved',  permission: 'questions.review', description: 'Approve (final stage) — ready to publish' },
    { action: ReviewAction.reject,          to: 'draft',     permission: 'questions.review', description: 'Reject back to draft' },
    { action: ReviewAction.request_changes, to: 'draft',     permission: 'questions.review', description: 'Request changes — return to draft' },
  ],
  approved: [
    { action: ReviewAction.publish, to: 'published', permission: 'questions.publish', description: 'Publish an approved question' },
    { action: ReviewAction.reject,  to: 'draft',     permission: 'questions.review',  description: 'Send approved question back to draft' },
  ],
  published: [
    { action: ReviewAction.archive, to: 'archived', permission: 'questions.publish', description: 'Archive a published question' },
    { action: ReviewAction.flag,    to: 'flagged',  permission: 'questions.review',  description: 'Flag a published question for attention' },
  ],
  flagged: [
    { action: ReviewAction.unflag,  to: 'published', permission: 'questions.review', description: 'Clear a flag, return to published' },
    { action: ReviewAction.archive, to: 'archived',  permission: 'questions.publish', description: 'Archive a flagged question' },
  ],
  archived: [
    // Archived is terminal except for an explicit clone (handled separately).
  ],
};

/** Find the transition rule for an action from a given status, or undefined. */
export function findTransition(from: QStatus, action: ReviewAction): TransitionRule | undefined {
  return TRANSITIONS[from]?.find((t) => t.action === action);
}
