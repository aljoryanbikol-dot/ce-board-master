/**
 * @file study-planner.controller.ts
 * @module Student/Controllers
 */
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StudyPlannerService } from '../services/study-planner.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import {
  UpsertGoalSchema, CreatePlanSchema, CreateTaskSchema, UpdateTaskStatusSchema,
  UpsertGoalDtoClass, CreatePlanDtoClass, CreateTaskDtoClass, UpdateTaskStatusDtoClass,
} from '../dto/student.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('Student — Study Planner')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.STUDENT_LEARN)
@Controller('student/planner')
export class StudyPlannerController {
  constructor(private readonly planner: StudyPlannerService) {}

  // Goals
  @Post('goals')
  @ApiOperation({ summary: 'Create or update a study goal (daily/weekly/monthly)' })
  @ApiBody({ type: UpsertGoalDtoClass })
  async upsertGoal(@Body(new ZodValidationPipe(UpsertGoalSchema)) body: typeof UpsertGoalSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.planner.upsertGoal(user.id, body);
  }

  @Get('goals')
  @ApiOperation({ summary: 'List active study goals' })
  async listGoals(@CurrentUser() user: AuthenticatedUser) {
    return this.planner.listGoals(user.id);
  }

  // Plans
  @Post('plans')
  @ApiOperation({ summary: 'Create a study plan' })
  @ApiBody({ type: CreatePlanDtoClass })
  async createPlan(@Body(new ZodValidationPipe(CreatePlanSchema)) body: typeof CreatePlanSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.planner.createPlan(user.id, body);
  }

  @Get('plans')
  @ApiOperation({ summary: 'List study plans' })
  async listPlans(@CurrentUser() user: AuthenticatedUser) {
    return this.planner.listPlans(user.id);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get a study plan with tasks (ownership-checked)' })
  @ApiParam({ name: 'id' })
  async getPlan(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.planner.getPlan(user.id, id);
  }

  @Delete('plans/:id')
  @ApiOperation({ summary: 'Delete a study plan' })
  @ApiParam({ name: 'id' })
  async deletePlan(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.planner.deletePlan(user.id, id);
  }

  // Tasks
  @Post('plans/:id/tasks')
  @ApiOperation({ summary: 'Add a task to a study plan' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: CreateTaskDtoClass })
  async addTask(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(CreateTaskSchema)) body: typeof CreateTaskSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.planner.addTask(user.id, id, body);
  }

  @Patch('tasks/:taskId/status')
  @ApiOperation({ summary: 'Update a task status' })
  @ApiParam({ name: 'taskId' })
  @ApiBody({ type: UpdateTaskStatusDtoClass })
  async updateTaskStatus(@Param('taskId', ParseUUIDPipe) taskId: string, @Body(new ZodValidationPipe(UpdateTaskStatusSchema)) body: typeof UpdateTaskStatusSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.planner.updateTaskStatus(user.id, taskId, body);
  }

  // Calendar
  @Get('calendar')
  @ApiOperation({ summary: 'Calendar of tasks within a date range' })
  @ApiQuery({ name: 'from', example: '2026-07-01' })
  @ApiQuery({ name: 'to', example: '2026-07-31' })
  async calendar(@Query('from') from: string, @Query('to') to: string, @CurrentUser() user: AuthenticatedUser) {
    return this.planner.calendar(user.id, from, to);
  }
}
