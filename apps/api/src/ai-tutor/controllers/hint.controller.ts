/**
 * @file hint.controller.ts
 * @module AITutor/Controllers
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HintService } from '../services/hint.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { HintSchema, HintDtoClass } from '../dto/tutor.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('AI Tutor — Hints')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.TUTOR_USE)
@Controller('tutor/hint')
export class HintController {
  constructor(private readonly hints: HintService) {}

  @Post()
  @ApiOperation({ summary: 'Get a progressive hint for a question (never reveals the answer)' })
  @ApiBody({ type: HintDtoClass })
  async hint(@Body(new ZodValidationPipe(HintSchema)) body: typeof HintSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.hints.hint(user.id, body.questionId, body.level);
  }
}
