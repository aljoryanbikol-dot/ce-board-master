/**
 * @file editorial.module.ts
 * @module Editorial
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { EditorialController } from './controllers/editorial.controller';
import { EditorialService } from './services/editorial.service';

@Module({
  imports: [AuthModule, RbacModule, KnowledgeModule],
  controllers: [EditorialController],
  providers: [EditorialService],
  exports: [EditorialService],
})
export class EditorialModule {}
