/**
 * @file cms-workflow.service.spec.ts
 * @module Cms/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CmsWorkflowService } from '../services/cms-workflow.service';

const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'free' as const };

const mockWorkflow = {
  submitForReview: vi.fn(), approve: vi.fn(), reject: vi.fn(), publish: vi.fn(),
  archive: vi.fn(), flag: vi.fn(), unflag: vi.fn(), getWorkflowHistory: vi.fn(),
};
const mockCmsQuestion = { assignReview: vi.fn() };
const mockEvents = { emit: vi.fn() };

const build = () => new CmsWorkflowService(mockWorkflow as never, mockCmsQuestion as never, mockEvents as never);

describe('CmsWorkflowService', () => {
  let service: CmsWorkflowService;
  beforeEach(() => { vi.clearAllMocks(); service = build(); });

  describe('single transitions (delegation)', () => {
    it('submit() delegates to QuestionWorkflowService', async () => {
      mockWorkflow.submitForReview.mockResolvedValue({ status: 'in_review' });
      await service.submit('q-1', user, 'go');
      expect(mockWorkflow.submitForReview).toHaveBeenCalledWith('q-1', user, 'go');
    });
    it('approve() delegates', async () => {
      mockWorkflow.approve.mockResolvedValue({});
      await service.approve('q-1', user, 'ok');
      expect(mockWorkflow.approve).toHaveBeenCalledWith('q-1', user, 'ok');
    });
    it('reject() delegates with reason+flag', async () => {
      mockWorkflow.reject.mockResolvedValue({});
      await service.reject('q-1', user, 'bad', true);
      expect(mockWorkflow.reject).toHaveBeenCalledWith('q-1', user, 'bad', true);
    });
    it('publish/archive/flag/unflag/history delegate', async () => {
      mockWorkflow.publish.mockResolvedValue({});
      mockWorkflow.archive.mockResolvedValue({});
      mockWorkflow.flag.mockResolvedValue({});
      mockWorkflow.unflag.mockResolvedValue({});
      mockWorkflow.getWorkflowHistory.mockResolvedValue([]);
      await service.publish('q-1', user);
      await service.archive('q-1', user);
      await service.flag('q-1', user, 'r');
      await service.unflag('q-1', user);
      await service.history('q-1', user);
      expect(mockWorkflow.publish).toHaveBeenCalled();
      expect(mockWorkflow.archive).toHaveBeenCalled();
      expect(mockWorkflow.flag).toHaveBeenCalledWith('q-1', user, 'r');
      expect(mockWorkflow.unflag).toHaveBeenCalled();
      expect(mockWorkflow.getWorkflowHistory).toHaveBeenCalled();
    });
  });

  describe('bulk()', () => {
    it('reports all-success when every item succeeds', async () => {
      mockWorkflow.approve.mockResolvedValue({});
      const result = await service.bulk({ operation: 'approve', questionIds: ['q-1', 'q-2', 'q-3'] } as never, user);
      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockEvents.emit).toHaveBeenCalledWith('cms.bulk.operation', expect.anything());
    });

    it('accounts partial failures without aborting the batch', async () => {
      mockWorkflow.publish
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(Object.assign(new Error('x'), { response: { code: 'NOT_PUBLISHABLE', message: 'not approved' } }))
        .mockResolvedValueOnce({});
      const result = await service.bulk({ operation: 'publish', questionIds: ['q-1', 'q-2', 'q-3'] } as never, user);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toMatchObject({ questionId: 'q-2', code: 'NOT_PUBLISHABLE' });
    });

    it('bulk reject passes the reason through', async () => {
      mockWorkflow.reject.mockResolvedValue({});
      await service.bulk({ operation: 'reject', questionIds: ['q-1'], reason: 'batch reason' } as never, user);
      expect(mockWorkflow.reject).toHaveBeenCalledWith('q-1', user, 'batch reason', false);
    });

    it('bulk assign composes CmsQuestionService.assignReview', async () => {
      mockCmsQuestion.assignReview.mockResolvedValue({});
      const result = await service.bulk({ operation: 'assign', questionIds: ['q-1', 'q-2'], assigneeId: 'rev-1', stage: 'technical' } as never, user);
      expect(result.succeeded).toBe(2);
      expect(mockCmsQuestion.assignReview).toHaveBeenCalledWith('q-1', { assigneeId: 'rev-1', stage: 'technical' }, user);
    });

    it('bulk submit delegates per item', async () => {
      mockWorkflow.submitForReview.mockResolvedValue({});
      const result = await service.bulk({ operation: 'submit', questionIds: ['q-1', 'q-2'] } as never, user);
      expect(result.succeeded).toBe(2);
      expect(mockWorkflow.submitForReview).toHaveBeenCalledTimes(2);
    });
  });
});
