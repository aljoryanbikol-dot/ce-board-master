/**
 * @file knowledge.integration.spec.ts
 * @module Knowledge/Integration
 *
 * Wires the REAL knowledge services together (only Prisma, Cache, and the event
 * bus are mocked) and exercises the full Sprint 2.8 flow end-to-end at the
 * service layer:
 *   ingest a document → create a Learning Objective → create a Blueprint
 *   referencing it → create a cross-reference edge → build the dependency graph
 *   → full-text search.
 *
 * This proves the engines compose correctly (validation gates, public-ID
 * generation, versioning, graph traversal) without a live database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentParserService } from '../../src/knowledge/services/document-parser.service';
import { PublicIdService } from '../../src/knowledge/services/public-id.service';
import { ValidationEngineService } from '../../src/knowledge/services/validation-engine.service';
import { KnowledgeIngestionService } from '../../src/knowledge/services/knowledge-ingestion.service';
import { CrossReferenceService } from '../../src/knowledge/services/cross-reference.service';
import { KnowledgeSearchService } from '../../src/knowledge/services/knowledge-search.service';
import { LearningObjectiveService } from '../../src/learning-objectives/services/learning-objective.service';
import { BlueprintService } from '../../src/blueprints/services/blueprint.service';

const user = { id: 'u-1', email: 'admin@ce.com', role: 'content_admin', subscriptionTier: 'pro' as const };

/** A tiny in-memory store standing in for Prisma across the engines. */
function makeStore() {
  return {
    documents: [] as any[],
    versions: [] as any[],
    sections: [] as any[],
    los: [] as any[],
    loVersions: [] as any[],
    blueprints: [] as any[],
    xrefs: [] as any[],
  };
}

function makePrisma(store: ReturnType<typeof makeStore>) {
  const tx = {
    knowledgeDocument: {
      create: vi.fn(async ({ data }: any) => { const d = { id: `doc-${store.documents.length + 1}`, createdAt: new Date(), updatedAt: new Date(), status: 'draft', ...data }; store.documents.push(d); return { ...d, versions: [] }; }),
      update: vi.fn(async ({ where, data }: any) => { const d = store.documents.find((x) => x.id === where.id); Object.assign(d, data); return d; }),
    },
    knowledgeDocumentVersion: {
      updateMany: vi.fn(async ({ where, data }: any) => { store.versions.filter((v) => v.documentId === where.documentId && (where.isCurrent === undefined || v.isCurrent === where.isCurrent)).forEach((v) => Object.assign(v, data)); return {}; }),
      create: vi.fn(async ({ data }: any) => { const v = { id: `ver-${store.versions.length + 1}`, createdAt: new Date(), publishedAt: null, status: 'draft', ...data }; store.versions.push(v); return v; }),
    },
    knowledgeSection: {
      deleteMany: vi.fn(async ({ where }: any) => { store.sections = store.sections.filter((s) => s.documentId !== where.documentId); return {}; }),
      createMany: vi.fn(async ({ data }: any) => { store.sections.push(...data); return { count: data.length }; }),
    },
    learningObjective: {
      create: vi.fn(async ({ data }: any) => { const lo = { id: `lo-${store.los.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data }; store.los.push(lo); return lo; }),
      update: vi.fn(async ({ where, data }: any) => { const lo = store.los.find((x) => x.id === where.id); Object.assign(lo, data); return lo; }),
    },
    learningObjectiveVersion: {
      updateMany: vi.fn(async () => ({})),
      create: vi.fn(async ({ data }: any) => { store.loVersions.push(data); return data; }),
    },
    questionBlueprint: {
      create: vi.fn(async ({ data }: any) => { const bp = { id: `bp-${store.blueprints.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data }; store.blueprints.push(bp); return bp; }),
    },
  };

  return {
    knowledgeDocument: {
      findFirst: vi.fn(async ({ where }: any) => { const d = store.documents.find((x) => x.bookNumber === where.bookNumber); if (!d) return null; return { ...d, versions: store.versions.filter((v) => v.documentId === d.id && v.isCurrent) }; }),
      findUnique: vi.fn(async ({ where }: any) => store.documents.find((x) => x.id === where.id) ?? null),
    },
    learningObjective: {
      findUnique: vi.fn(async ({ where }: any) => store.los.find((x) => x.publicId === where.publicId) ?? null),
      findFirst: vi.fn(async ({ where }: any) => store.los.find((x) => x.id === where.id) ?? null),
      findMany: vi.fn(async () => store.los),
      count: vi.fn(async () => store.los.length),
    },
    questionBlueprint: {
      findUnique: vi.fn(async ({ where }: any) => store.blueprints.find((x) => x.publicId === where.publicId) ?? null),
      findMany: vi.fn(async () => store.blueprints),
      create: vi.fn(async ({ data }: any) => { const bp = { id: `bp-${store.blueprints.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data }; store.blueprints.push(bp); return bp; }),
    },
    formulaLibrary: { findMany: vi.fn(async () => []) },
    misconception: { findMany: vi.fn(async () => []) },
    knowledgeSection: { findMany: vi.fn(async () => store.sections) },
    knowledgeCrossReference: {
      findFirst: vi.fn(async ({ where }: any) => store.xrefs.find((x) => x.fromId === where.fromId && x.toId === where.toId && x.referenceType === where.referenceType) ?? null),
      findMany: vi.fn(async ({ where }: any) => store.xrefs.filter((x) => (where.fromId ? x.fromId === where.fromId : true) && (where.fromType ? x.fromType === where.fromType : true) && (where.referenceType ? x.referenceType === where.referenceType : true))),
      create: vi.fn(async ({ data }: any) => { const x = { id: `xref-${store.xrefs.length + 1}`, createdAt: new Date(), note: null, ...data }; store.xrefs.push(x); return x; }),
    },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  };
}

describe('Knowledge Base — integration (real services, mocked persistence)', () => {
  let store: ReturnType<typeof makeStore>;
  let prisma: ReturnType<typeof makePrisma>;
  let ingestion: KnowledgeIngestionService;
  let los: LearningObjectiveService;
  let blueprints: BlueprintService;
  let crossRef: CrossReferenceService;
  let search: KnowledgeSearchService;

  const cache = { invalidatePattern: vi.fn(), remember: vi.fn(async (_k: string, _t: number, f: () => unknown) => f()), buildKey: vi.fn((ns: string, k: string) => `${ns}:${k}`) };
  const events = { emit: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    prisma = makePrisma(store);
    const publicId = new PublicIdService();
    const validator = new ValidationEngineService(publicId);
    ingestion = new KnowledgeIngestionService(prisma as never, cache as never, new DocumentParserService(), events as never);
    los = new LearningObjectiveService(prisma as never, cache as never, publicId, validator, events as never);
    blueprints = new BlueprintService(prisma as never, cache as never, publicId, validator, events as never);
    crossRef = new CrossReferenceService(prisma as never, events as never);
    search = new KnowledgeSearchService(prisma as never);
  });

  it('runs the full knowledge flow: ingest → LO → blueprint → cross-ref → graph → search', async () => {
    // 1. Ingest the Learning Objectives book.
    const content = '**Book 11**\n\n**4.2 Identifier Structure**\n\nThe official Learning Objective ID format shall be LO dash subject. Stress analysis governs structural design.';
    const ingested = await ingestion.ingest({ bookNumber: 11, title: 'Learning Objectives Master Library', contentText: content }, user);
    expect(ingested.created).toBe(true);
    expect(ingested.version.versionNumber).toBe(1);
    expect(store.sections.length).toBeGreaterThan(0);

    // 2. Create a Learning Objective (validated + versioned).
    const lo = await los.create({ subjectCode: 'STR', topicCode: 1, subtopicCode: 3, sequenceNumber: 1, statement: 'Compute the normal stress in an axially loaded member.', bloomLevel: 'apply', measurable: true, keywords: ['stress'], sourceDocumentId: ingested.document.id } as never, user);
    expect(lo.publicId).toBe('LO-STR-001-003-001');
    expect(store.loVersions.length).toBe(1);

    // 3. Create a Blueprint referencing the LO.
    const bp = await blueprints.create({ subjectCode: 'STR', topicCode: 4, subtopicCode: 2, blueprintType: 'CMP', sequenceNumber: 1, name: 'Axial stress computation', primaryObjectiveId: lo.id, structure: { steps: 3 } } as never, user);
    expect(bp.publicId).toBe('BP-STR-004-002-CMP-001');

    // 4. Cross-reference: blueprint → LO.
    const xref = await crossRef.create({ referenceType: 'blueprint_to_lo', fromType: 'blueprint', fromId: bp.id, fromPublicId: bp.publicId, toType: 'learning_objective', toId: lo.id, toPublicId: lo.publicId, weight: 1 } as never, user);
    expect(xref.referenceType).toBe('blueprint_to_lo');

    // 5. Dependency graph rooted at the blueprint reaches the LO.
    const graph = await crossRef.buildGraph('blueprint', bp.id);
    expect(graph.nodes.map((n) => n.id)).toContain(lo.id);
    expect(graph.edges.length).toBe(1);

    // 6. Full-text search finds the LO by its statement keyword.
    const results = await search.search({ q: 'stress', types: 'learning_objective', limit: 10 } as never);
    expect(results.hits.some((h) => h.publicId === 'LO-STR-001-003-001')).toBe(true);
  });

  it('enforces validation across the composed services', async () => {
    const err = await los.create({ subjectCode: 'ZZZ', topicCode: 1, subtopicCode: 3, sequenceNumber: 1, statement: 'Invalid subject objective statement.', bloomLevel: 'apply', measurable: true, keywords: [] } as never, user).catch((e) => e);
    expect(err.getResponse().code).toBe('VALIDATION_FAILED');
  });

  it('keeps document ingestion idempotent on identical content', async () => {
    const content = '**Book 15**\n\n**1.1 Purpose**\n\nThe editorial style guide governs all written content.';
    await ingestion.ingest({ bookNumber: 15, title: 'Editorial Style Guide', contentText: content }, user);
    const err = await ingestion.ingest({ bookNumber: 15, title: 'Editorial Style Guide', contentText: content }, user).catch((e) => e);
    expect(err.getResponse().code).toBe('DUPLICATE_CONTENT');
  });
});
