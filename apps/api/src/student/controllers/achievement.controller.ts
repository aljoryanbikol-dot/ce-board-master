/**
 * @file achievement.controller.ts
 * @module Student/Controllers
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AchievementService } from '../services/achievement.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { LeaderboardQuerySchema } from '../dto/student.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('Student — Achievements')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.STUDENT_PROGRESS)
@Controller('student/achievements')
export class AchievementController {
  constructor(private readonly achievements: AchievementService) {}

  @Get()
  @ApiOperation({ summary: 'Earned achievements, XP, and level' })
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.achievements.getStudentAchievements(user.id);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'XP leaderboard (leaderboard-ready architecture)' })
  async leaderboard(@Query(new ZodValidationPipe(LeaderboardQuerySchema)) q: typeof LeaderboardQuerySchema._type) {
    return this.achievements.leaderboard(q.limit);
  }
}
