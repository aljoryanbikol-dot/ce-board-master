/**
 * @file question-workflow.controller.spec.ts
 * @module Questions/Tests
 *
 * Workflow controller delegation tests via direct instantiation (see
 * question.controller.spec.ts for why Test.createTestingModule is avoided).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestionWorkflowController } from '../controllers/question-workflow.controller';

const mockWorkflow = {
  submitForReview: vi.fn(), approve: vi.fn(), reject: vi.fn(), publish: vi.fn(),
  archive: vi.fn(), flag: vi.fn(), unflag: vi.fn(), getWorkflowHistory: vi.fn(),
};
const user = { id: 'u-1', email: 'u@b.com', role: 'reviewer', subscriptionTier: 'free' };

describe('QuestionWorkflowController', () => {
  let ctrl: QuestionWorkflowController;
  beforeEach(() => {
    vi.clearAllMocks();
    ctrl = new QuestionWorkflowController(mockWorkflow as never);
  });

  it('submit() delegates with notes', async () => {
    mockWorkflow.submitForReview.mockResolvedValue({ status: 'in_review' });
    await ctrl.submit('q-1', { notes: 'go' } as never, user as never);
    expect(mockWorkflow.submitForReview).toHaveBeenCalledWith('q-1', user, 'go');
  });

  it('approve() delegates', async () => {
    mockWorkflow.approve.mockResolvedValue({ status: 'in_review' });
    await ctrl.approve('q-1', { notes: 'ok' } as never, user as never);
    expect(mockWorkflow.approve).toHaveBeenCalledWith('q-1', user, 'ok');
  });

  it('reject() passes reason and requestChanges', async () => {
    mockWorkflow.reject.mockResolvedValue({ status: 'draft' });
    await ctrl.reject('q-1', { reason: 'fix units', requestChanges: true } as never, user as never);
    expect(mockWorkflow.reject).toHaveBeenCalledWith('q-1', user, 'fix units', true);
  });

  it('publish() delegates', async () => {
    mockWorkflow.publish.mockResolvedValue({ status: 'published' });
    await ctrl.publish('q-1', { notes: 'live' } as never, user as never);
    expect(mockWorkflow.publish).toHaveBeenCalledWith('q-1', user, 'live');
  });

  it('archive() delegates', async () => {
    mockWorkflow.archive.mockResolvedValue({ status: 'archived' });
    await ctrl.archive('q-1', {} as never, user as never);
    expect(mockWorkflow.archive).toHaveBeenCalledWith('q-1', user, undefined);
  });

  it('flag() passes the reason', async () => {
    mockWorkflow.flag.mockResolvedValue({ status: 'flagged' });
    await ctrl.flag('q-1', { reason: 'bad key' } as never, user as never);
    expect(mockWorkflow.flag).toHaveBeenCalledWith('q-1', user, 'bad key');
  });

  it('unflag() delegates', async () => {
    mockWorkflow.unflag.mockResolvedValue({ status: 'published' });
    await ctrl.unflag('q-1', {} as never, user as never);
    expect(mockWorkflow.unflag).toHaveBeenCalledWith('q-1', user, undefined);
  });

  it('history() delegates', async () => {
    mockWorkflow.getWorkflowHistory.mockResolvedValue([]);
    await ctrl.history('q-1', user as never);
    expect(mockWorkflow.getWorkflowHistory).toHaveBeenCalledWith('q-1', user);
  });
});
