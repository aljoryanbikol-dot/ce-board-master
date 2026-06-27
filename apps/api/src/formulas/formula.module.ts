/**
 * @file formula.module.ts
 * @module Formulas
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { FormulaController } from './controllers/formula.controller';
import { FormulaService } from './services/formula.service';

@Module({
  imports: [AuthModule, RbacModule, KnowledgeModule],
  controllers: [FormulaController],
  providers: [FormulaService],
  exports: [FormulaService],
})
export class FormulaModule {}
