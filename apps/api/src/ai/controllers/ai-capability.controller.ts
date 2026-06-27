/**
 * @file ai-capability.controller.ts
 * @module AI/Controllers
 *
 * AICapabilityController — focused generation capabilities that do not create a
 * full generation request: standalone distractor generation (grounded in the
 * Misconception Library). Base: /api/v1/ai/capabilities. Guarded by auth + role +
 * `ai.generate`.
 */
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DistractorService } from '../services/distractor.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import { GenerateDistractorsSchema, GenerateDistractorsDtoClass } from '../dto/ai.dto';

const AI_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('AI — Capabilities')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...AI_ROLES)
@Permissions(PERM.AI_USE)
@Controller('ai/capabilities')
export class AICapabilityController {
  constructor(private readonly distractors: DistractorService) {}

  @Post('distractors')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.AI_GENERATE)
  @ApiOperation({ summary: 'Generate misconception-grounded distractors for a Learning Objective' })
  @ApiBody({ type: GenerateDistractorsDtoClass })
  async generateDistractors(
    @Body(new ZodValidationPipe(GenerateDistractorsSchema)) body: typeof GenerateDistractorsSchema._type,
  ) {
    return this.distractors.generate(body);
  }
}
