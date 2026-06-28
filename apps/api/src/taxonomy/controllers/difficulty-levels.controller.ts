/**
 * @file difficulty-levels.controller.ts — read access to difficulty levels.
 * Base path: /api/v1/admin/difficulty-levels.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DifficultyLevelsService } from '../services/difficulty-levels.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { PERM } from '../../rbac/rbac.constants';

@ApiTags('Admin — Difficulty Levels')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.CMS_ACCESS)
@Controller('admin/difficulty-levels')
export class DifficultyLevelsController {
  constructor(private readonly service: DifficultyLevelsService) {}

  @Get()
  @ApiOperation({ summary: 'List difficulty levels' })
  list() {
    return this.service.list();
  }
}
