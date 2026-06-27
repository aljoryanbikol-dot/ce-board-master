/**
 * @file question.controller.spec.ts
 * @module Questions/Tests
 *
 * Controller delegation tests. The controller is instantiated directly with
 * mocked services (constructor injection by hand) rather than through
 * Test.createTestingModule, because the project's Vitest/esbuild transform does
 * not emit `design:paramtypes` metadata, which Nest's DI needs to resolve
 * constructor params by type. Direct instantiation tests the same delegation
 * contract without that dependency. Guards are not exercised here (they are
 * covered by the e2e suite).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestionController } from '../controllers/question.controller';

const mockQuestionService = {
  create: vi.fn(), findById: vi.fn(), update: vi.fn(), softDelete: vi.fn(), clone: vi.fn(),
};
const mockSearchService = {
  search: vi.fn(), getVersions: vi.fn(), getVersionSnapshot: vi.fn(), bulkImport: vi.fn(), bulkExport: vi.fn(),
};
const user = { id: 'u-1', email: 'u@b.com', role: 'content_author', subscriptionTier: 'free' };

describe('QuestionController', () => {
  let ctrl: QuestionController;
  beforeEach(() => {
    vi.clearAllMocks();
    ctrl = new QuestionController(mockQuestionService as never, mockSearchService as never);
  });

  it('search() delegates to the search service', async () => {
    mockSearchService.search.mockResolvedValue({ data: [], pagination: {} });
    await ctrl.search({ limit: 20 } as never, user as never);
    expect(mockSearchService.search).toHaveBeenCalledWith({ limit: 20 }, user);
  });

  it('create() delegates to the question service', async () => {
    mockQuestionService.create.mockResolvedValue({ id: 'q-1' });
    const r = await ctrl.create({ questionCode: 'X' } as never, user as never);
    expect(r).toEqual({ id: 'q-1' });
    expect(mockQuestionService.create).toHaveBeenCalled();
  });

  it('findOne() delegates with the id and user', async () => {
    mockQuestionService.findById.mockResolvedValue({ id: 'q-1' });
    await ctrl.findOne('q-1', user as never);
    expect(mockQuestionService.findById).toHaveBeenCalledWith('q-1', user);
  });

  it('versions() and versionSnapshot() delegate', async () => {
    mockSearchService.getVersions.mockResolvedValue([]);
    mockSearchService.getVersionSnapshot.mockResolvedValue({});
    await ctrl.versions('q-1', user as never);
    await ctrl.versionSnapshot('q-1', 2);
    expect(mockSearchService.getVersions).toHaveBeenCalledWith('q-1', user);
    expect(mockSearchService.getVersionSnapshot).toHaveBeenCalledWith('q-1', 2);
  });

  it('update() delegates', async () => {
    mockQuestionService.update.mockResolvedValue({ id: 'q-1', currentVersion: 2 });
    await ctrl.update('q-1', { stemText: 'new' } as never, user as never);
    expect(mockQuestionService.update).toHaveBeenCalledWith('q-1', { stemText: 'new' }, user);
  });

  it('remove() delegates and returns void', async () => {
    mockQuestionService.softDelete.mockResolvedValue(undefined);
    const r = await ctrl.remove('q-1', user as never);
    expect(r).toBeUndefined();
    expect(mockQuestionService.softDelete).toHaveBeenCalledWith('q-1', user);
  });

  it('clone() delegates', async () => {
    mockQuestionService.clone.mockResolvedValue({ id: 'q-2' });
    await ctrl.clone('q-1', user as never);
    expect(mockQuestionService.clone).toHaveBeenCalledWith('q-1', user);
  });

  it('bulkImport() and bulkExport() delegate', async () => {
    mockSearchService.bulkImport.mockResolvedValue({ imported: 1 });
    mockSearchService.bulkExport.mockResolvedValue({ count: 1 });
    await ctrl.bulkImport({ questions: [], atomic: true } as never, user as never);
    await ctrl.bulkExport({ limit: 1000 } as never, user as never);
    expect(mockSearchService.bulkImport).toHaveBeenCalled();
    expect(mockSearchService.bulkExport).toHaveBeenCalled();
  });
});
