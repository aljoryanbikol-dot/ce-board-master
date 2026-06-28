/**
 * @file taxonomy.module.ts
 *
 * Admin taxonomy CRUD: Subjects → Topics (Categories) → Subtopics, plus (later)
 * Tags, Difficulty Levels and References. Thin controllers over PrismaService;
 * guarded by JwtAuthGuard + PermissionGuard (cms.access / questions.manage).
 * PrismaService comes from the global DatabaseModule.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { SubjectsController } from './controllers/subjects.controller';
import { TopicsController } from './controllers/topics.controller';
import { SubtopicsController } from './controllers/subtopics.controller';
import { SubjectsService } from './services/subjects.service';
import { TopicsService } from './services/topics.service';
import { SubtopicsService } from './services/subtopics.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [SubjectsController, TopicsController, SubtopicsController],
  providers: [SubjectsService, TopicsService, SubtopicsService],
})
export class TaxonomyModule {}
