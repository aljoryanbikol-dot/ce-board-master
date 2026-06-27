/**
 * @file student-dashboard.controller.ts
 * @module Student/Controllers
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudentDashboardService } from '../services/student-dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PERM } from '../../rbac/rbac.constants';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('Student — Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.STUDENT_LEARN)
@Controller('student/dashboard')
export class StudentDashboardController {
  constructor(private readonly dashboard: StudentDashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Student dashboard summary (continue learning, goals, streak, XP, weak/strong topics)' })
  async get(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getDashboard(user.id);
  }
}
