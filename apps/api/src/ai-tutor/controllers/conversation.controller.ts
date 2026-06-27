/**
 * @file conversation.controller.ts
 * @module AITutor/Controllers
 */
import { Controller, Delete, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ConversationService } from '../services/conversation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { PaginationSchema } from '../dto/tutor.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('AI Tutor — Conversations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.TUTOR_HISTORY)
@Controller('tutor/conversations')
export class ConversationController {
  constructor(private readonly conversations: ConversationService) {}

  @Get()
  @ApiOperation({ summary: 'List the student\'s tutoring conversations' })
  async list(@Query(new ZodValidationPipe(PaginationSchema)) q: typeof PaginationSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.conversations.list(user.id, q.limit, q.cursor);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get a conversation\'s messages with citations (session history)' })
  @ApiParam({ name: 'id' })
  async messages(@Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(PaginationSchema)) q: typeof PaginationSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.conversations.getMessages(user.id, id, q.limit, q.cursor);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a conversation' })
  @ApiParam({ name: 'id' })
  async archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversations.archive(user.id, id);
  }
}
