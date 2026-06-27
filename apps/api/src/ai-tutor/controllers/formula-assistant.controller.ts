/**
 * @file formula-assistant.controller.ts
 * @module AITutor/Controllers
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FormulaAssistantService } from '../services/formula-assistant.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { FormulaQuerySchema, FormulaQueryDtoClass } from '../dto/tutor.dto';

@ApiTags('AI Tutor — Formula Assistant')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.TUTOR_USE)
@Controller('tutor/formula')
export class FormulaAssistantController {
  constructor(private readonly formulas: FormulaAssistantService) {}

  @Post()
  @ApiOperation({ summary: 'Look up formulas and get grounded usage guidance' })
  @ApiBody({ type: FormulaQueryDtoClass })
  async assist(@Body(new ZodValidationPipe(FormulaQuerySchema)) body: typeof FormulaQuerySchema._type) {
    return this.formulas.assist(body.query, { subjectId: body.subjectId, topicId: body.topicId });
  }
}
