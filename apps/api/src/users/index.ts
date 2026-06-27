/**
 * @file index.ts
 * @module Users
 * Barrel export for the Users module (Sprint 2.4).
 */
export { UsersModule } from './users.module';
export { UsersService } from './services/users.service';
export { UsersController } from './controllers/users.controller';
export type { UserDetail, UserSummary, UserListResult, UserChangedEvent } from './users.types';
export { USER_ERROR_CODES, type UserErrorCode } from './users.constants';
export { UserErrors } from './users.errors';
export {
  ListUsersQuerySchema, type ListUsersQueryDto,
  UpdateUserSchema, type UpdateUserDto,
  UpdateUserDtoClass, UserSummaryDto, UserDetailDto,
} from './dto/user.dto';
