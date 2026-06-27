/**
 * @file knowledge-search.service.spec.ts
 * @module Knowledge/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeSearchService } from '../services/knowledge-search.service';

const mockPrisma = {
  learningObjective: { findMany: vi.fn() },
  formulaLibrary: { findMany: vi.fn() },
  questionBlueprint: { findMany: vi.fn() },
  misconception: { findMany: vi.fn() },
  knowledgeSection: { findMany: vi.fn() },
};
const build = () => new KnowledgeSearchService(mockPrisma as never);

describe('KnowledgeSearchService', () => {
  let svc: KnowledgeSearchService;
  beforeEach(() => {
    vi.clearAllMocks();
    svc = build();
    mockPrisma.learningObjective.findMany.mockResolvedValue([]);
    mockPrisma.formulaLibrary.findMany.mockResolvedValue([]);
    mockPrisma.questionBlueprint.findMany.mockResolvedValue([]);
    mockPrisma.misconception.findMany.mockResolvedValue([]);
    mockPrisma.knowledgeSection.findMany.mockResolvedValue([]);
  });

  it('searches all entity types by default and ranks hits', async () => {
    mockPrisma.learningObjective.findMany.mockResolvedValue([{ id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'stress analysis basics' }]);
    mockPrisma.formulaLibrary.findMany.mockResolvedValue([{ id: 'f-1', name: 'stress', expressionText: 'σ = P/A' }]);
    const result = await svc.search({ q: 'stress', limit: 20 } as never);
    expect(result.hits.length).toBe(2);
    // exact-name formula 'stress' scores higher than partial LO statement
    expect(result.hits[0]!.type).toBe('formula');
  });

  it('restricts to requested types', async () => {
    mockPrisma.misconception.findMany.mockResolvedValue([{ id: 'mc-1', publicId: 'MC-STR-003-002-FRM-001', title: 'unit error', description: 'confusing units in calc' }]);
    const result = await svc.search({ q: 'unit', types: 'misconception', limit: 20 } as never);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]!.type).toBe('misconception');
    expect(mockPrisma.learningObjective.findMany).not.toHaveBeenCalled();
  });

  it('produces a snippet around the match', async () => {
    mockPrisma.knowledgeSection.findMany.mockResolvedValue([{ id: 's-1', heading: 'Identifier', bodyText: 'The official Learning Objective ID format shall be LO dash subject.', documentId: 'doc-1' }]);
    const result = await svc.search({ q: 'format', types: 'section', limit: 10 } as never);
    expect(result.hits[0]!.snippet.toLowerCase()).toContain('format');
  });

  it('honors the limit', async () => {
    mockPrisma.learningObjective.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ id: `lo-${i}`, publicId: `LO-STR-001-003-00${i}`, statement: 'stress concept' })),
    );
    const result = await svc.search({ q: 'stress', types: 'learning_objective', limit: 3 } as never);
    expect(result.hits.length).toBe(3);
  });
});
