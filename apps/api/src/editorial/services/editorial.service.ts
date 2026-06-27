/**
 * @file editorial.service.ts
 * @module Editorial/Services
 *
 * EditorialService — exposes the governance & standards documents (Books 1, 3,
 * 5, 6, 7, 8, 9, 10, 14, 15) as read-only, versioned, full-text-searchable
 * specifications. These books carry no structured entities (unlike the LO,
 * Blueprint, Misconception, Formula libraries); they ARE the editorial,
 * explanation, diagram, psychometric, distractor, AI, and writing standards that
 * govern content production.
 *
 * Thin composition layer: document reads delegate to KnowledgeIngestionService,
 * section/full-text search delegates to KnowledgeSearchService. No direct
 * persistence of its own.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KnowledgeIngestionService } from '../../knowledge/services/knowledge-ingestion.service';
import { KnowledgeSearchService } from '../../knowledge/services/knowledge-search.service';
import { KnowledgeErrors } from '../../knowledge/knowledge.errors';
import { EDITORIAL_BOOK_NUMBERS, BOOK_DOCUMENT_TYPES } from '../../knowledge/constants/knowledge.constants';

@Injectable()
export class EditorialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: KnowledgeIngestionService,
    private readonly search: KnowledgeSearchService,
  ) {}

  /** List the governance/standards documents (the editorial book set). */
  async listStandards() {
    const docs = await this.ingestion.listDocuments();
    const editorialBooks = new Set<number>(EDITORIAL_BOOK_NUMBERS as readonly number[]);
    return docs.filter((d) => editorialBooks.has(d.bookNumber));
  }

  /** Get one standards document by book number. */
  async getStandardByBook(bookNumber: number) {
    const editorialBooks = new Set<number>(EDITORIAL_BOOK_NUMBERS as readonly number[]);
    if (!editorialBooks.has(bookNumber)) {
      throw KnowledgeErrors.badRequest(`Book ${bookNumber} is not an editorial/standards document.`);
    }
    const doc = await this.prisma.knowledgeDocument.findFirst({ where: { bookNumber, deletedAt: null } });
    if (!doc) throw KnowledgeErrors.documentNotFound(`book-${bookNumber}`);
    return this.ingestion.getDocument(doc.id);
  }

  /** The parsed sections (table of contents + bodies) of a standards document. */
  async getSections(documentId: string) {
    const doc = await this.prisma.knowledgeDocument.findFirst({ where: { id: documentId, deletedAt: null }, select: { id: true } });
    if (!doc) throw KnowledgeErrors.documentNotFound(documentId);
    const sections = await this.prisma.knowledgeSection.findMany({
      where: { documentId }, orderBy: { orderIndex: 'asc' },
      select: { id: true, anchor: true, heading: true, level: true, orderIndex: true, wordCount: true },
    });
    return sections.map((s: (typeof sections)[number]) => ({
      id: s.id, anchor: s.anchor, heading: s.heading, level: s.level, orderIndex: s.orderIndex, wordCount: s.wordCount,
    }));
  }

  /** Full-text search restricted to document sections (the standards corpus). */
  async searchStandards(q: string, limit = 20) {
    return this.search.search({ q, types: 'section', limit });
  }

  /** Map of which standards book governs which production concern. */
  getStandardsCatalog() {
    return (EDITORIAL_BOOK_NUMBERS as readonly number[]).map((n) => ({
      bookNumber: n,
      documentType: BOOK_DOCUMENT_TYPES[n as keyof typeof BOOK_DOCUMENT_TYPES],
    }));
  }
}
