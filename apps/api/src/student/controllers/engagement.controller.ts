/**
 * @file engagement.controller.ts
 * @module Student/Controllers
 */
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { EngagementService } from '../services/engagement.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import {
  CreateBookmarkSchema, FavoriteSchema, ViewQuestionSchema, PaginationSchema, HistoryQuerySchema,
  CreateBookmarkDtoClass, FavoriteDtoClass, ViewQuestionDtoClass,
} from '../dto/student.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('Student — Engagement')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.STUDENT_LEARN)
@Controller('student')
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  // Bookmarks
  @Post('bookmarks')
  @ApiOperation({ summary: 'Bookmark a question' })
  @ApiBody({ type: CreateBookmarkDtoClass })
  async addBookmark(@Body(new ZodValidationPipe(CreateBookmarkSchema)) body: typeof CreateBookmarkSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.engagement.addBookmark(user.id, body);
  }

  @Delete('bookmarks/:questionId')
  @ApiOperation({ summary: 'Remove a bookmark' })
  @ApiParam({ name: 'questionId' })
  async removeBookmark(@Param('questionId', ParseUUIDPipe) questionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.engagement.removeBookmark(user.id, questionId);
  }

  @Get('bookmarks')
  @ApiOperation({ summary: 'List bookmarks' })
  async listBookmarks(@Query(new ZodValidationPipe(PaginationSchema)) q: typeof PaginationSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.engagement.listBookmarks(user.id, q.limit, q.cursor);
  }

  // Favorites
  @Post('favorites')
  @ApiOperation({ summary: 'Favorite a question' })
  @ApiBody({ type: FavoriteDtoClass })
  async addFavorite(@Body(new ZodValidationPipe(FavoriteSchema)) body: typeof FavoriteSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.engagement.addFavorite(user.id, body.questionId);
  }

  @Delete('favorites/:questionId')
  @ApiOperation({ summary: 'Remove a favorite' })
  @ApiParam({ name: 'questionId' })
  async removeFavorite(@Param('questionId', ParseUUIDPipe) questionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.engagement.removeFavorite(user.id, questionId);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'List favorites' })
  async listFavorites(@Query(new ZodValidationPipe(PaginationSchema)) q: typeof PaginationSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.engagement.listFavorites(user.id, q.limit, q.cursor);
  }

  // Recently viewed
  @Post('recently-viewed')
  @ApiOperation({ summary: 'Record a question view' })
  @ApiBody({ type: ViewQuestionDtoClass })
  async recordView(@Body(new ZodValidationPipe(ViewQuestionSchema)) body: typeof ViewQuestionSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.engagement.recordView(user.id, body.questionId);
  }

  @Get('recently-viewed')
  @ApiOperation({ summary: 'List recently viewed questions' })
  async listRecentlyViewed(@Query(new ZodValidationPipe(PaginationSchema)) q: typeof PaginationSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.engagement.listRecentlyViewed(user.id, q.limit);
  }

  // History
  @Get('history')
  @ApiOperation({ summary: 'Question answer history (filterable)' })
  async history(@Query(new ZodValidationPipe(HistoryQuerySchema)) q: typeof HistoryQuerySchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.engagement.questionHistory(user.id, q);
  }

  @Get('recently-answered')
  @ApiOperation({ summary: 'Recently answered questions' })
  async recentlyAnswered(@Query(new ZodValidationPipe(PaginationSchema)) q: typeof PaginationSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.engagement.recentlyAnswered(user.id, q.limit);
  }
}
