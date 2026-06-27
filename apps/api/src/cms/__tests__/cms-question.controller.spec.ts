/**
 * @file cms-question.controller.spec.ts
 * @module Cms/Tests
 *
 * Controller delegation tests via direct instantiation (the project's
 * Vitest/esbuild transform does not emit the param metadata Nest DI needs, so
 * Test.createTestingModule cannot resolve providers here; direct instantiation
 * tests the same delegation contract robustly).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CmsQuestionController } from '../controllers/cms-question.controller';

const cms = {
  getQuestionDetail: vi.fn(), getVersionHistory: vi.fn(), getActivityTimeline: vi.fn(),
  getLock: vi.fn(), acquireLock: vi.fn(), releaseLock: vi.fn(),
  listAssignments: vi.fn(), assignReview: vi.fn(), updateAssignment: vi.fn(),
  listComments: vi.fn(), addComment: vi.fn(), resolveComment: vi.fn(),
  listNotes: vi.fn(), addNote: vi.fn(), deleteNote: vi.fn(),
};
const analytics = { search: vi.fn() };
const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'free' };

describe('CmsQuestionController', () => {
  let ctrl: CmsQuestionController;
  beforeEach(() => { vi.clearAllMocks(); ctrl = new CmsQuestionController(cms as never, analytics as never); });

  it('search() delegates to analytics', async () => {
    analytics.search.mockResolvedValue({ data: [] });
    await ctrl.search({ limit: 20 } as never, user as never);
    expect(analytics.search).toHaveBeenCalledWith({ limit: 20 }, user);
  });

  it('detail/versions/timeline delegate', async () => {
    cms.getQuestionDetail.mockResolvedValue({}); cms.getVersionHistory.mockResolvedValue([]); cms.getActivityTimeline.mockResolvedValue([]);
    await ctrl.detail('q-1', user as never);
    await ctrl.versions('q-1', user as never);
    await ctrl.timeline('q-1', user as never);
    expect(cms.getQuestionDetail).toHaveBeenCalledWith('q-1', user);
    expect(cms.getVersionHistory).toHaveBeenCalledWith('q-1', user);
    expect(cms.getActivityTimeline).toHaveBeenCalledWith('q-1', user);
  });

  it('lock endpoints delegate', async () => {
    cms.getLock.mockResolvedValue(null); cms.acquireLock.mockResolvedValue({}); cms.releaseLock.mockResolvedValue(undefined);
    await ctrl.getLock('q-1');
    await ctrl.acquireLock('q-1', { ttlSeconds: 60 } as never, user as never);
    await ctrl.releaseLock('q-1', user as never);
    expect(cms.getLock).toHaveBeenCalledWith('q-1');
    expect(cms.acquireLock).toHaveBeenCalledWith('q-1', { ttlSeconds: 60 }, user);
    expect(cms.releaseLock).toHaveBeenCalledWith('q-1', user);
  });

  it('assignment endpoints delegate', async () => {
    cms.listAssignments.mockResolvedValue([]); cms.assignReview.mockResolvedValue({}); cms.updateAssignment.mockResolvedValue({});
    await ctrl.assignments('q-1');
    await ctrl.assign('q-1', { assigneeId: 'r', stage: 'technical' } as never, user as never);
    await ctrl.updateAssignment('a-1', { status: 'accepted' } as never, user as never);
    expect(cms.assignReview).toHaveBeenCalledWith('q-1', { assigneeId: 'r', stage: 'technical' }, user);
    expect(cms.updateAssignment).toHaveBeenCalledWith('a-1', { status: 'accepted' }, user);
  });

  it('comment endpoints delegate', async () => {
    cms.listComments.mockResolvedValue([]); cms.addComment.mockResolvedValue({}); cms.resolveComment.mockResolvedValue({});
    await ctrl.comments('q-1');
    await ctrl.addComment('q-1', { body: 'hi' } as never, user as never);
    await ctrl.resolveComment('c-1', user as never);
    expect(cms.addComment).toHaveBeenCalledWith('q-1', { body: 'hi' }, user);
    expect(cms.resolveComment).toHaveBeenCalledWith('c-1', user);
  });

  it('note endpoints delegate', async () => {
    cms.listNotes.mockResolvedValue([]); cms.addNote.mockResolvedValue({}); cms.deleteNote.mockResolvedValue(undefined);
    await ctrl.notes('q-1');
    await ctrl.addNote('q-1', { body: 'n' } as never, user as never);
    await ctrl.deleteNote('n-1', user as never);
    expect(cms.addNote).toHaveBeenCalledWith('q-1', { body: 'n' }, user);
    expect(cms.deleteNote).toHaveBeenCalledWith('n-1', user);
  });
});
