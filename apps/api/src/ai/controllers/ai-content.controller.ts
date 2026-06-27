/**
 * @file ai-content.controller.ts
 * @module AI/Controllers
 *
 * AIContentController — the AI Content Generation Engine API.
 * Base: /api/v1/ai. Thin: delegates to services; zero Prisma. Guarded by auth +
 * role + AI permissions. Generation requires `ai.generate`; promotion to the
 * Question Bank requires `ai.review`.
 */
import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AIContentService } from '../services/ai-content.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import {
  GenerateFromLoSchema, GenerateFromBlueprintSchema, GenerateVariantsSchema,
  PromoteGenerationSchema, ListGenerationsSchema,
  GenerateFromLoDtoClass, GenerateFromBlueprintDtoClass, GenerateVariantsDtoClass, PromoteGenerationDtoClass,
} from '../dto/ai.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

const AI_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('AI — Content Generation')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...AI_ROLES)
@Permissions(PERM.AI_USE)
@Controller('ai')
export class AIContentController {
  constructor(private readonly ai: AIContentService) {}

  @Post('generate/from-learning-objective')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.AI_GENERATE)
  @ApiOperation({ summary: 'Generate question(s) grounded in a Learning Objective' })
  @ApiBody({ type: GenerateFromLoDtoClass })
  async fromLo(
    @Body(new ZodValidationPipe(GenerateFromLoSchema)) body: typeof GenerateFromLoSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ai.generateFromLearningObjective(body, user);
  }

  @Post('generate/from-blueprint')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.AI_GENERATE)
  @ApiOperation({ summary: 'Generate question(s) by executing a Blueprint' })
  @ApiBody({ type: GenerateFromBlueprintDtoClass })
  async fromBlueprint(
    @Body(new ZodValidationPipe(GenerateFromBlueprintSchema)) body: typeof GenerateFromBlueprintSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ai.generateFromBlueprint(body, user);
  }

  @Post('generate/variants')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.AI_GENERATE)
  @ApiOperation({ summary: 'Generate numerical/conceptual variants of a prior generation' })
  @ApiBody({ type: GenerateVariantsDtoClass })
  async variants(
    @Body(new ZodValidationPipe(GenerateVariantsSchema)) body: typeof GenerateVariantsSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ai.generateVariants(body, user);
  }

  @Post(':id/promote')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.AI_REVIEW)
  @ApiOperation({ summary: 'Promote a validated generation variant into the CMS as a question draft' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: PromoteGenerationDtoClass })
  async promote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PromoteGenerationSchema)) body: typeof PromoteGenerationSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ai.promote(id, body, user);
  }

  @Get('generations')
  @ApiOperation({ summary: 'List generation requests' })
  async list(@Query(new ZodValidationPipe(ListGenerationsSchema)) query: typeof ListGenerationsSchema._type) {
    return this.ai.list(query);
  }

  @Get('generations/:id')
  @ApiOperation({ summary: 'Get a generation request with its variants' })
  @ApiParam({ name: 'id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ai.findById(id);
  }

  @Get('generations/:id/audit-log')
  @ApiOperation({ summary: 'Append-only audit log of a generation request' })
  @ApiParam({ name: 'id' })
  async auditLog(@Param('id', ParseUUIDPipe) id: string) {
    return this.ai.getAuditLog(id);
  }
}
