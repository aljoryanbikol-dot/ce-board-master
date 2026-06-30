/**
 * @file content-sync.module.ts — generic Knowledge Library sync engine.
 * PrismaService comes from the global DatabaseModule.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { QuestionsModule } from '../questions/questions.module';
import { ContentSyncController } from './content-sync.controller';
import { ContentSyncService } from './content-sync.service';
import { QuestionSyncService } from './question-sync.service';

@Module({
  imports: [AuthModule, RbacModule, QuestionsModule],
  controllers: [ContentSyncController],
  providers: [ContentSyncService, QuestionSyncService],
})
export class ContentSyncModule {}
