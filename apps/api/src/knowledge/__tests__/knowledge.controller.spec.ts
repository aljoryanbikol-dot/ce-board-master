/**
 * @file knowledge.controller.spec.ts
 * @module Knowledge/Tests
 *
 * Controller delegation tests via direct instantiation (the project's
 * Vitest/esbuild transform omits the param metadata Nest DI needs).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeController } from '../controllers/knowledge.controller';

const ingestion = { ingest: vi.fn(), publishDocument: vi.fn(), listDocuments: vi.fn(), getDocument: vi.fn(), listVersions: vi.fn() };
const search = { search: vi.fn() };
const crossRef = { create: vi.fn(), remove: vi.fn(), listForEntity: vi.fn(), buildGraph: vi.fn() };
const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' };

describe('KnowledgeController', () => {
  let ctrl: KnowledgeController;
  beforeEach(() => { vi.clearAllMocks(); ctrl = new KnowledgeController(ingestion as never, search as never, crossRef as never); });

  it('ingest delegates', async () => {
    ingestion.ingest.mockResolvedValue({ created: true });
    await ctrl.ingest({ bookNumber: 11 } as never, user as never);
    expect(ingestion.ingest).toHaveBeenCalledWith({ bookNumber: 11 }, user);
  });
  it('publishDocument delegates', async () => {
    ingestion.publishDocument.mockResolvedValue({});
    await ctrl.publishDocument('d-1', user as never);
    expect(ingestion.publishDocument).toHaveBeenCalledWith('d-1', user);
  });
  it('listDocuments/getDocument/listVersions delegate', async () => {
    ingestion.listDocuments.mockResolvedValue([]); ingestion.getDocument.mockResolvedValue({}); ingestion.listVersions.mockResolvedValue([]);
    await ctrl.listDocuments(); await ctrl.getDocument('d-1'); await ctrl.listVersions('d-1');
    expect(ingestion.listDocuments).toHaveBeenCalled();
    expect(ingestion.getDocument).toHaveBeenCalledWith('d-1');
    expect(ingestion.listVersions).toHaveBeenCalledWith('d-1');
  });
  it('search delegates to the search service', async () => {
    search.search.mockResolvedValue({ hits: [] });
    await ctrl.search({ q: 'stress', limit: 20 } as never);
    expect(search.search).toHaveBeenCalledWith({ q: 'stress', limit: 20 });
  });
  it('cross-reference endpoints delegate', async () => {
    crossRef.create.mockResolvedValue({}); crossRef.remove.mockResolvedValue(undefined);
    crossRef.listForEntity.mockResolvedValue({ outgoing: [], incoming: [] }); crossRef.buildGraph.mockResolvedValue({ nodes: [], edges: [] });
    await ctrl.createCrossRef({ referenceType: 'lo_to_formula' } as never, user as never);
    await ctrl.removeCrossRef('x-1');
    await ctrl.entityCrossRefs('learning_objective', 'lo-1');
    await ctrl.entityGraph('learning_objective', 'lo-1', '3');
    expect(crossRef.create).toHaveBeenCalled();
    expect(crossRef.remove).toHaveBeenCalledWith('x-1');
    expect(crossRef.listForEntity).toHaveBeenCalledWith('learning_objective', 'lo-1');
    expect(crossRef.buildGraph).toHaveBeenCalledWith('learning_objective', 'lo-1', 3);
  });
});
