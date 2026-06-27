/**
 * @file knowledge-ingestion.service.ts
 * @module Knowledge/Services
 *
 * KnowledgeIngestionService — versioned ingestion of the official enterprise
 * documents (Books 1–15).
 *
 * On ingest:
 *  1. Parse the extracted text → checksum + sections + word count.
 *  2. If the document (by book number) doesn't exist yet, create it (v1).
 *     Otherwise create the next version — UNLESS the checksum matches the
 *     current version, in which case ingestion is idempotent (no-op, reports
 *     duplicate) so re-running an import is safe.
 *  3. Replace the parsed sections for the document (the full-text index source).
 *  4. Emit an audit event.
 *
 * The latest published version is the authoritative specification. Older
 * versions remain for audit.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { DocumentParserService } from './document-parser.service';
import { KnowledgeErrors } from '../knowledge.errors';
import { EVENTS } from '../../common/constants';
import { BOOK_DOCUMENT_TYPES, KNOWLEDGE_CACHE_PREFIX } from '../constants/knowledge.constants';
import type { IngestDocumentDto } from '../dto/knowledge.dto';
import type { KnowledgeDocumentView, DocumentVersionView } from '../types/knowledge.types';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class KnowledgeIngestionService {
  private readonly logger = new Logger(KnowledgeIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly parser: DocumentParserService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async ingest(dto: IngestDocumentDto, user: AuthenticatedUser): Promise<{ document: KnowledgeDocumentView; version: DocumentVersionView; created: boolean }> {
    const parsed = this.parser.parse(dto.contentText);
    const documentType = BOOK_DOCUMENT_TYPES[dto.bookNumber as keyof typeof BOOK_DOCUMENT_TYPES];
    const slug = this.slugify(dto.title, dto.bookNumber);

    const existing = await this.prisma.knowledgeDocument.findFirst({
      where: { bookNumber: dto.bookNumber },
      include: { versions: { where: { isCurrent: true }, take: 1 } },
    });

    // Idempotency: identical content as the current version → no new version.
    if (existing?.versions[0]?.contentChecksum === parsed.contentChecksum) {
      throw KnowledgeErrors.duplicateContent();
    }

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let document = existing;
      let created = false;

      if (!document) {
        document = await tx.knowledgeDocument.create({
          data: {
            bookNumber: dto.bookNumber, documentType: documentType as never, title: dto.title, slug,
            description: dto.description ?? null, ownerTeam: dto.ownerTeam ?? null,
            currentVersion: 1, latestSemver: dto.semver ?? '1.0.0', createdBy: user.id,
            sourceFilename: null,
          },
          include: { versions: true },
        });
        created = true;
      }

      const nextVersion = created ? 1 : document.currentVersion + 1;
      const semver = dto.semver ?? this.bumpMinor(document.latestSemver);

      // New current version; demote previous.
      await tx.knowledgeDocumentVersion.updateMany({ where: { documentId: document.id, isCurrent: true }, data: { isCurrent: false } });
      const version = await tx.knowledgeDocumentVersion.create({
        data: {
          documentId: document.id, versionNumber: nextVersion, semver,
          contentText: parsed.contentText, contentChecksum: parsed.contentChecksum,
          sectionCount: parsed.sections.length, wordCount: parsed.wordCount,
          changeSummary: dto.changeSummary ?? (created ? 'Initial ingestion' : 'Re-ingested document'),
          ingestedBy: user.id, isCurrent: true,
        },
      });

      if (!created) {
        await tx.knowledgeDocument.update({
          where: { id: document.id },
          data: { currentVersion: nextVersion, latestSemver: semver, title: dto.title, updatedAt: new Date() },
        });
      }

      // Replace parsed sections (the full-text index source).
      await tx.knowledgeSection.deleteMany({ where: { documentId: document.id } });
      if (parsed.sections.length > 0) {
        await tx.knowledgeSection.createMany({
          data: parsed.sections.map((s) => ({
            documentId: document!.id, anchor: s.anchor, heading: s.heading.slice(0, 400),
            level: s.level, orderIndex: s.orderIndex, bodyText: s.bodyText, wordCount: s.wordCount,
          })),
        });
      }

      return { document, version, created };
    });

    await this.cache.invalidatePattern(`${KNOWLEDGE_CACHE_PREFIX}*`);
    this.eventEmitter.emit(
      result.created ? EVENTS.KNOWLEDGE_DOC_INGESTED : EVENTS.KNOWLEDGE_DOC_VERSIONED,
      { documentId: result.document.id, bookNumber: dto.bookNumber, version: result.version.versionNumber, actorId: user.id, timestamp: new Date().toISOString() },
    );
    this.logger.log({ message: 'Knowledge document ingested', bookNumber: dto.bookNumber, version: result.version.versionNumber, sections: parsed.sections.length, created: result.created });

    // Re-read the canonical document so the returned view always carries every
    // field (the version-bump path starts from a possibly-partial findFirst row).
    const fresh = await this.prisma.knowledgeDocument.findUnique({ where: { id: result.document.id } });
    return {
      document: this.toDocView(fresh ?? result.document),
      version: this.toVersionView(result.version),
      created: result.created,
    };
  }

  async publishDocument(documentId: string, user: AuthenticatedUser): Promise<KnowledgeDocumentView> {
    const doc = await this.prisma.knowledgeDocument.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) throw KnowledgeErrors.documentNotFound(documentId);

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.knowledgeDocumentVersion.updateMany({
        where: { documentId, isCurrent: true },
        data: { status: 'published', publishedAt: new Date() },
      });
      return tx.knowledgeDocument.update({ where: { id: documentId }, data: { status: 'published' } });
    });

    await this.cache.invalidatePattern(`${KNOWLEDGE_CACHE_PREFIX}*`);
    this.eventEmitter.emit(EVENTS.KNOWLEDGE_DOC_PUBLISHED, { documentId, actorId: user.id, timestamp: new Date().toISOString() });
    return this.toDocView(updated);
  }

  async listDocuments(): Promise<KnowledgeDocumentView[]> {
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { deletedAt: null }, orderBy: { bookNumber: 'asc' },
    });
    return docs.map((d: (typeof docs)[number]) => this.toDocView(d));
  }

  async getDocument(documentId: string): Promise<KnowledgeDocumentView> {
    const doc = await this.prisma.knowledgeDocument.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) throw KnowledgeErrors.documentNotFound(documentId);
    return this.toDocView(doc);
  }

  async listVersions(documentId: string): Promise<DocumentVersionView[]> {
    const doc = await this.prisma.knowledgeDocument.findFirst({ where: { id: documentId, deletedAt: null }, select: { id: true } });
    if (!doc) throw KnowledgeErrors.documentNotFound(documentId);
    const versions = await this.prisma.knowledgeDocumentVersion.findMany({
      where: { documentId }, orderBy: { versionNumber: 'desc' },
    });
    return versions.map((v: (typeof versions)[number]) => this.toVersionView(v));
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private slugify(title: string, bookNumber: number): string {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140);
    return `book-${bookNumber}-${base}`;
  }

  private bumpMinor(semver: string): string {
    const [maj, min] = semver.split('.').map(Number);
    return `${maj ?? 1}.${(min ?? 0) + 1}.0`;
  }

  private toDocView(d: {
    id: string; bookNumber: number; documentType: string; title: string; slug: string;
    description: string | null; status: string; currentVersion: number; latestSemver: string;
    ownerTeam: string | null; createdAt: Date; updatedAt: Date;
  }): KnowledgeDocumentView {
    return {
      id: d.id, bookNumber: d.bookNumber, documentType: d.documentType, title: d.title, slug: d.slug,
      description: d.description, status: d.status, currentVersion: d.currentVersion, latestSemver: d.latestSemver,
      ownerTeam: d.ownerTeam, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
    };
  }

  private toVersionView(v: {
    id: string; documentId: string; versionNumber: number; semver: string; status: string;
    contentChecksum: string; sectionCount: number; wordCount: number; changeSummary: string | null;
    isCurrent: boolean; publishedAt: Date | null; createdAt: Date;
  }): DocumentVersionView {
    return {
      id: v.id, documentId: v.documentId, versionNumber: v.versionNumber, semver: v.semver, status: v.status,
      contentChecksum: v.contentChecksum, sectionCount: v.sectionCount, wordCount: v.wordCount,
      changeSummary: v.changeSummary, isCurrent: v.isCurrent,
      publishedAt: v.publishedAt?.toISOString() ?? null, createdAt: v.createdAt.toISOString(),
    };
  }
}
