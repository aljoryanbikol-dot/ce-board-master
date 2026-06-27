/**
 * @file cms-workflow.service.ts
 * @module Cms/Services
 *
 * CmsWorkflowService — orchestrates the editorial workflow from the CMS.
 *
 * Every single-question transition DELEGATES to the frozen Sprint 2.6
 * QuestionWorkflowService, so the status machine and all transition rules live
 * in exactly one place. This service adds the CMS-level concern on top: BULK
 * operations across many questions, with per-item success/failure accounting
 * (one bad question never aborts the batch).
 *
 * Bulk assign is the exception that also touches CmsQuestionService (the owner
 * of assignments); it is composed here so the controller has a single bulk
 * entry point.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QuestionWorkflowService } from '../../questions/services/question-workflow.service';
import { CmsQuestionService } from './cms-question.service';
import { EVENTS } from '../../common/constants';
import { CmsErrors } from '../cms.errors';
import { BULK_OPERATIONS } from '../constants/cms.constants';
import type { BulkOperationDto } from '../dto/cms.dto';
import type { BulkOperationResult } from '../types/cms.types';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class CmsWorkflowService {
  private readonly logger = new Logger(CmsWorkflowService.name);

  constructor(
    private readonly workflow: QuestionWorkflowService,
    private readonly cmsQuestion: CmsQuestionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Single-question transitions (thin delegation) ────────────────────────────

  submit(id: string, user: AuthenticatedUser, notes?: string) {
    return this.workflow.submitForReview(id, user, notes);
  }
  approve(id: string, user: AuthenticatedUser, notes?: string) {
    return this.workflow.approve(id, user, notes);
  }
  reject(id: string, user: AuthenticatedUser, reason: string, requestChanges: boolean) {
    return this.workflow.reject(id, user, reason, requestChanges);
  }
  publish(id: string, user: AuthenticatedUser, notes?: string) {
    return this.workflow.publish(id, user, notes);
  }
  archive(id: string, user: AuthenticatedUser, notes?: string) {
    return this.workflow.archive(id, user, notes);
  }
  flag(id: string, user: AuthenticatedUser, reason: string) {
    return this.workflow.flag(id, user, reason);
  }
  unflag(id: string, user: AuthenticatedUser, notes?: string) {
    return this.workflow.unflag(id, user, notes);
  }
  history(id: string, user: AuthenticatedUser) {
    return this.workflow.getWorkflowHistory(id, user);
  }

  // ── Bulk operations ──────────────────────────────────────────────────────────

  async bulk(dto: BulkOperationDto, user: AuthenticatedUser): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      operation: dto.operation, total: dto.questionIds.length, succeeded: 0, failed: 0, errors: [],
    };

    for (const questionId of dto.questionIds) {
      try {
        await this.applyOne(dto, questionId, user);
        result.succeeded++;
      } catch (err) {
        result.failed++;
        result.errors.push({ questionId, code: this.errCode(err), message: this.errMessage(err) });
      }
    }

    this.eventEmitter.emit(EVENTS.CMS_BULK_OPERATION, {
      operation: dto.operation, total: result.total, succeeded: result.succeeded, failed: result.failed,
      actorId: user.id, timestamp: new Date().toISOString(),
    });
    this.logger.log({ message: 'CMS bulk operation', operation: dto.operation, total: result.total, succeeded: result.succeeded, failed: result.failed, actorId: user.id });
    return result;
  }

  private async applyOne(dto: BulkOperationDto, questionId: string, user: AuthenticatedUser): Promise<void> {
    switch (dto.operation) {
      case BULK_OPERATIONS.SUBMIT:
        await this.workflow.submitForReview(questionId, user, dto.reason);
        return;
      case BULK_OPERATIONS.APPROVE:
        await this.workflow.approve(questionId, user, dto.reason);
        return;
      case BULK_OPERATIONS.REJECT:
        await this.workflow.reject(questionId, user, dto.reason ?? 'Bulk rejection', false);
        return;
      case BULK_OPERATIONS.PUBLISH:
        await this.workflow.publish(questionId, user, dto.reason);
        return;
      case BULK_OPERATIONS.ARCHIVE:
        await this.workflow.archive(questionId, user, dto.reason);
        return;
      case BULK_OPERATIONS.ASSIGN:
        if (!dto.assigneeId || !dto.stage) throw CmsErrors.bulkInvalid('assigneeId and stage are required for assign.');
        await this.cmsQuestion.assignReview(questionId, { assigneeId: dto.assigneeId, stage: dto.stage as never }, user);
        return;
      default:
        throw CmsErrors.bulkInvalid(`Unknown operation: ${dto.operation}`);
    }
  }

  private errCode(err: unknown): string {
    return (err as { response?: { code?: string } })?.response?.code ?? 'BULK_ITEM_ERROR';
  }
  private errMessage(err: unknown): string {
    return (err as { response?: { message?: string } })?.response?.message ?? (err instanceof Error ? err.message : 'Unknown error');
  }
}
