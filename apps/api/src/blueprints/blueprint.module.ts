/**
 * @file blueprint.module.ts
 * @module Blueprints
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { BlueprintController } from './controllers/blueprint.controller';
import { BlueprintService } from './services/blueprint.service';

@Module({
  imports: [AuthModule, RbacModule, KnowledgeModule],
  controllers: [BlueprintController],
  providers: [BlueprintService],
  exports: [BlueprintService],
})
export class BlueprintModule {}
