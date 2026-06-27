/**
 * @file ai-tutor.controller.ts
 * @module AITutor/Controllers
 */
import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AITutorService } from '../services/ai-tutor.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { StartConversationSchema, SendMessageSchema, AskSchema, StartConversationDtoClass, SendMessageDtoClass, AskDtoClass } from '../dto/tutor.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('AI Tutor — Chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.TUTOR_USE)
@Controller('tutor')
export class AITutorController {
  constructor(private readonly tutor: AITutorService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Start a tutoring conversation (optionally with a first message)' })
  @ApiBody({ type: StartConversationDtoClass })
  async start(@Body(new ZodValidationPipe(StartConversationSchema)) body: typeof StartConversationSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.tutor.startConversation(user.id, body);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message and get a grounded tutor answer (multi-turn)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: SendMessageDtoClass })
  async send(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(SendMessageSchema)) body: typeof SendMessageSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.tutor.sendMessage(user.id, id, body);
  }

  @Post('ask')
  @ApiOperation({ summary: 'Ask any engineering question (one-shot, creates a conversation)' })
  @ApiBody({ type: AskDtoClass })
  async ask(@Body(new ZodValidationPipe(AskSchema)) body: typeof AskSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.tutor.startConversation(user.id, { title: body.question.slice(0, 80), subjectId: body.subjectId, topicId: body.topicId, firstMessage: body.question });
  }
}
