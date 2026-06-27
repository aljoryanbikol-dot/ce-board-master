/**
 * @file solution.controller.ts
 * @module AITutor/Controllers
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SolutionService } from '../services/solution.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { SolutionSchema, SolutionDtoClass } from '../dto/tutor.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('AI Tutor — Solution Engine')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.TUTOR_USE)
@Controller('tutor/solution')
export class SolutionController {
  constructor(private readonly solution: SolutionService) {}

  @Post()
  @ApiOperation({ summary: 'Step-by-step worked solution for a published question' })
  @ApiBody({ type: SolutionDtoClass })
  async solve(@Body(new ZodValidationPipe(SolutionSchema)) body: typeof SolutionSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.solution.solve(user.id, body.questionId);
  }
}
