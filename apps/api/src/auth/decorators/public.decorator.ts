/**
 * @file public.decorator.ts
 * @module Auth/Decorators
 *
 * @Public() route decorator — marks an endpoint as publicly accessible
 * (no JWT authentication required).
 *
 * How it works:
 * - Sets the metadata key IS_PUBLIC_KEY on the route handler
 * - JwtAuthGuard reads this metadata and skips token verification
 *
 * Apply to:
 * - Route handlers (method level) — affects only that endpoint
 * - Controller classes (class level) — affects all endpoints in the controller
 *
 * Usage on a single endpoint:
 * @Public()
 * @Get('/health')
 * health() { return { status: 'ok' }; }
 *
 * Usage on entire controller:
 * @Public()
 * @Controller('auth')
 * export class AuthController { ... } // All routes are public
 *
 * Security consideration:
 * @Public() is for genuinely unauthenticated endpoints only:
 * - Health checks
 * - Auth endpoints (login, register, forgot-password)
 * - Public content browsing (subject list, sample questions)
 * Never apply @Public() to endpoints that return user-specific data.
 */
import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../auth.constants';

/**
 * Mark a route or controller as publicly accessible.
 * JwtAuthGuard will skip token verification for decorated routes.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
