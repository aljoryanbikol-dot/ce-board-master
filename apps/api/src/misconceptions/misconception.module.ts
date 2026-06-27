/**
 * @file misconception.module.ts
 * @module Misconceptions
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MisconceptionController } from './controllers/misconception.controller';
import { MisconceptionService } from './services/misconception.service';

@Module({
  imports: [AuthModule, RbacModule, KnowledgeModule],
  controllers: [MisconceptionController],
  providers: [MisconceptionService],
  exports: [MisconceptionService],
})
export class MisconceptionModule {}
