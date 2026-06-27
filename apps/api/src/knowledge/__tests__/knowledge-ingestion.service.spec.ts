/**
 * @file knowledge-ingestion.service.spec.ts
 * @module Knowledge/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { KnowledgeIngestionService } from '../services/knowledge-ingestion.service';
import { DocumentParserService } from '../services/document-parser.service';

const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' as const };

const tx = {
  knowledgeDocument: { create: vi.fn(), update: vi.fn() },
  knowledgeDocumentVersion: { updateMany: vi.fn(), create: vi.fn() },
  knowledgeSection: { deleteMany: vi.fn(), createMany: vi.fn() },
};
const mockPrisma = {
  knowledgeDocument: { findFirst: vi.fn(), findUnique: vi.fn() },
  knowledgeDocumentVersion: {},
  $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
};
const mockCache = { invalidatePattern: vi.fn() };
const mockEvents = { emit: vi.fn() };

const CONTENT = '**Book 11**\n\n**1.1 Mission**\n\nEstablish a complete competency framework for engineering education.';

const build = () => new KnowledgeIngestionService(mockPrisma as never, mockCache as never, new DocumentParserService(), mockEvents as never);

describe('KnowledgeIngestionService', () => {
  let svc: KnowledgeIngestionService;
  beforeEach(() => {
    vi.clearAllMocks();
    svc = build();
    tx.knowledgeDocument.create.mockResolvedValue({ id: 'doc-1', bookNumber: 11, documentType: 'learning_objectives', title: 'LO Library', slug: 'book-11-lo', description: null, status: 'draft', currentVersion: 1, latestSemver: '1.0.0', ownerTeam: null, createdAt: new Date(), updatedAt: new Date(), versions: [] });
    tx.knowledgeDocumentVersion.create.mockResolvedValue({ id: 'v-1', documentId: 'doc-1', versionNumber: 1, semver: '1.0.0', status: 'draft', contentChecksum: 'abc', sectionCount: 1, wordCount: 10, changeSummary: 'Initial ingestion', isCurrent: true, publishedAt: null, createdAt: new Date() });
    tx.knowledgeSection.createMany.mockResolvedValue({});
    tx.knowledgeDocumentVersion.updateMany.mockResolvedValue({});
    tx.knowledgeSection.deleteMany.mockResolvedValue({});
    mockPrisma.knowledgeDocument.findUnique.mockResolvedValue({ id: 'doc-1', bookNumber: 11, documentType: 'learning_objectives', title: 'LO Library', slug: 'book-11-lo', description: null, status: 'draft', currentVersion: 1, latestSemver: '1.0.0', ownerTeam: null, createdAt: new Date(), updatedAt: new Date() });
  });

  it('creates a new document (v1) on first ingestion', async () => {
    mockPrisma.knowledgeDocument.findFirst.mockResolvedValue(null);
    const result = await svc.ingest({ bookNumber: 11, title: 'LO Library', contentText: CONTENT }, user);
    expect(result.created).toBe(true);
    expect(result.version.versionNumber).toBe(1);
    expect(tx.knowledgeDocument.create).toHaveBeenCalled();
    expect(tx.knowledgeSection.createMany).toHaveBeenCalled();
    expect(mockEvents.emit).toHaveBeenCalledWith('knowledge.document.ingested', expect.anything());
    expect(mockCache.invalidatePattern).toHaveBeenCalled();
  });

  it('is idempotent: identical content as current version throws DUPLICATE_CONTENT', async () => {
    const parser = new DocumentParserService();
    const checksum = parser.checksum(CONTENT);
    mockPrisma.knowledgeDocument.findFirst.mockResolvedValue({ id: 'doc-1', currentVersion: 1, latestSemver: '1.0.0', versions: [{ contentChecksum: checksum }] });
    const err = await svc.ingest({ bookNumber: 11, title: 'LO Library', contentText: CONTENT }, user).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().code).toBe('DUPLICATE_CONTENT');
  });

  it('creates the next version when content differs', async () => {
    mockPrisma.knowledgeDocument.findFirst.mockResolvedValue({ id: 'doc-1', currentVersion: 1, latestSemver: '1.0.0', versions: [{ contentChecksum: 'OLD-CHECKSUM' }] });
    tx.knowledgeDocumentVersion.create.mockResolvedValue({ id: 'v-2', documentId: 'doc-1', versionNumber: 2, semver: '1.1.0', status: 'draft', contentChecksum: 'new', sectionCount: 1, wordCount: 10, changeSummary: 'Re-ingested document', isCurrent: true, publishedAt: null, createdAt: new Date() });
    tx.knowledgeDocument.update.mockResolvedValue({});
    const result = await svc.ingest({ bookNumber: 11, title: 'LO Library v2', contentText: CONTENT + ' updated' }, user);
    expect(result.created).toBe(false);
    expect(result.version.versionNumber).toBe(2);
    expect(tx.knowledgeDocumentVersion.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isCurrent: false } }));
    expect(mockEvents.emit).toHaveBeenCalledWith('knowledge.document.versioned', expect.anything());
  });

  it('publishDocument marks current version published', async () => {
    mockPrisma.knowledgeDocument.findFirst.mockResolvedValue({ id: 'doc-1' });
    tx.knowledgeDocument.update.mockResolvedValue({ id: 'doc-1', bookNumber: 11, documentType: 'learning_objectives', title: 'X', slug: 's', description: null, status: 'published', currentVersion: 1, latestSemver: '1.0.0', ownerTeam: null, createdAt: new Date(), updatedAt: new Date() });
    const result = await svc.publishDocument('doc-1', user);
    expect(result.status).toBe('published');
    expect(mockEvents.emit).toHaveBeenCalledWith('knowledge.document.published', expect.anything());
  });
});
