/**
 * @file explanation.controller.ts
 * @module AITutor/Controllers
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExplanationService } from '../services/explanation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { ExplainConceptSchema, ExplainQuestionSchema, ExplainConceptDtoClass, ExplainQuestionDtoClass } from '../dto/tutor.dto';

@ApiTags('AI Tutor — Explanations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.TUTOR_USE)
@Controller('tutor/explain')
export class ExplanationController {
  constructor(private readonly explanation: ExplanationService) {}

  @Post('concept')
  @ApiOperation({ summary: 'Explain a concept (grounded in the Knowledge Base)' })
  @ApiBody({ type: ExplainConceptDtoClass })
  async concept(@Body(new ZodValidationPipe(ExplainConceptSchema)) body: typeof ExplainConceptSchema._type) {
    return this.explanation.explainConcept(body.concept, { subjectId: body.subjectId, topicId: body.topicId });
  }

  @Post('question')
  @ApiOperation({ summary: 'Explain a specific published question' })
  @ApiBody({ type: ExplainQuestionDtoClass })
  async question(@Body(new ZodValidationPipe(ExplainQuestionSchema)) body: typeof ExplainQuestionSchema._type) {
    return this.explanation.explainQuestion(body.questionId);
  }
}
