/**
 * @file handbook.module.ts
 * @module Handbook
 *
 * Fundamentals Handbook — read-only student projections of the Knowledge
 * Library (formulas, concepts, tips, diagrams). No content authoring here.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { HandbookController } from './handbook.controller';
import { HandbookService } from './handbook.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [HandbookController],
  providers: [HandbookService],
})
export class HandbookModule {}
