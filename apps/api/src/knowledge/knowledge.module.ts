/**
 * @file knowledge.module.ts
 * @module Knowledge
 *
 * KnowledgeModule — the core of the Content Knowledge Base (Sprint 2.8).
 * Provides the document ingestion/versioning engine, the validation engine, the
 * public-ID parser, the cross-reference + dependency-graph engine, and full-text
 * search. Exports all of these so the entity modules (LearningObjective, Formula,
 * Blueprint, Misconception, Editorial) compose them instead of duplicating the
 * governing rules.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { KnowledgeController } from './controllers/knowledge.controller';
import { PublicIdService } from './services/public-id.service';
import { DocumentParserService } from './services/document-parser.service';
import { ValidationEngineService } from './services/validation-engine.service';
import { KnowledgeIngestionService } from './services/knowledge-ingestion.service';
import { CrossReferenceService } from './services/cross-reference.service';
import { KnowledgeSearchService } from './services/knowledge-search.service';
import { KnowledgeIntegrationService } from './services/knowledge-integration.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [KnowledgeController],
  providers: [
    PublicIdService, DocumentParserService, ValidationEngineService,
    KnowledgeIngestionService, CrossReferenceService, KnowledgeSearchService,
    KnowledgeIntegrationService,
  ],
  exports: [
    PublicIdService, DocumentParserService, ValidationEngineService,
    KnowledgeIngestionService, CrossReferenceService, KnowledgeSearchService,
    KnowledgeIntegrationService,
  ],
})
export class KnowledgeModule {}
