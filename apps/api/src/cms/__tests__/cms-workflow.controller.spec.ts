/**
 * @file cms-workflow.controller.spec.ts
 * @module Cms/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CmsWorkflowController } from '../controllers/cms-workflow.controller';

const wf = {
  submit: vi.fn(), approve: vi.fn(), reject: vi.fn(), publish: vi.fn(),
  archive: vi.fn(), flag: vi.fn(), unflag: vi.fn(), history: vi.fn(), bulk: vi.fn(),
};
const user = { id: 'u-1', email: 'a@b.com', role: 'reviewer', subscriptionTier: 'free' };

describe('CmsWorkflowController', () => {
  let ctrl: CmsWorkflowController;
  beforeEach(() => { vi.clearAllMocks(); ctrl = new CmsWorkflowController(wf as never); });

  it('submit/approve delegate with notes', async () => {
    wf.submit.mockResolvedValue({}); wf.approve.mockResolvedValue({});
    await ctrl.submit('q-1', { notes: 'go' } as never, user as never);
    await ctrl.approve('q-1', { notes: 'ok' } as never, user as never);
    expect(wf.submit).toHaveBeenCalledWith('q-1', user, 'go');
    expect(wf.approve).toHaveBeenCalledWith('q-1', user, 'ok');
  });

  it('reject passes reason + requestChanges', async () => {
    wf.reject.mockResolvedValue({});
    await ctrl.reject('q-1', { reason: 'x', requestChanges: true } as never, user as never);
    expect(wf.reject).toHaveBeenCalledWith('q-1', user, 'x', true);
  });

  it('publish/archive/flag/unflag/history delegate', async () => {
    wf.publish.mockResolvedValue({}); wf.archive.mockResolvedValue({}); wf.flag.mockResolvedValue({});
    wf.unflag.mockResolvedValue({}); wf.history.mockResolvedValue([]);
    await ctrl.publish('q-1', {} as never, user as never);
    await ctrl.archive('q-1', {} as never, user as never);
    await ctrl.flag('q-1', { reason: 'r' } as never, user as never);
    await ctrl.unflag('q-1', {} as never, user as never);
    await ctrl.history('q-1', user as never);
    expect(wf.publish).toHaveBeenCalled();
    expect(wf.flag).toHaveBeenCalledWith('q-1', user, 'r');
    expect(wf.history).toHaveBeenCalledWith('q-1', user);
  });

  it('bulk delegates', async () => {
    wf.bulk.mockResolvedValue({ succeeded: 1 });
    await ctrl.bulk({ operation: 'approve', questionIds: ['q-1'] } as never, user as never);
    expect(wf.bulk).toHaveBeenCalledWith({ operation: 'approve', questionIds: ['q-1'] }, user);
  });
});
