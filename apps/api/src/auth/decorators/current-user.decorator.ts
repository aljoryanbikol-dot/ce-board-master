/**
 * @file current-user.decorator.ts
 * @module Auth/Decorators
 *
 * @CurrentUser() parameter decorator — extracts the authenticated user
 * from the Fastify request object.
 *
 * Populated by JwtStrategy.validate() after JwtAuthGuard runs.
 * The value is the AuthenticatedUser object { id, email, role, subscriptionTier }.
 *
 * Usage:
 * @Get('/profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return this.usersService.findProfile(user.id);
 * }
 *
 * Type-safe usage with specific field extraction:
 * @Get('/my-sessions')
 * getSessions(@CurrentUser('id') userId: string) {
 *   return this.sessionsService.list(userId);
 * }
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth.types';

/**
 * @CurrentUser() — Extract the full authenticated user from the request.
 * @CurrentUser('id') — Extract a specific field from the authenticated user.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      // This should never happen if JwtAuthGuard runs before the controller
      // If it does, the guard failed silently — log and return undefined
      return undefined;
    }

    return field ? user[field] : user;
  },
);
