/**
 * @file index.ts
 * @module Auth
 *
 * Auth module barrel export — Sprint 2.2 complete.
 *
 * Provides a single import path for everything consumers of the auth
 * module need: the module itself, all domain services, guards, decorators,
 * types, constants, DTOs/schemas, and utilities.
 */

// Module
export { AuthModule } from './auth.module';

// Controller (re-exported for test module construction)
export { AuthController } from './auth.controller';

// ── Infrastructure services ─────────────────────────────────────────────────
export { AuthService }     from './services/auth.service';
export { PasswordService } from './services/password.service';
export { TokenService }    from './services/token.service';
export { EmailService }    from './services/email.service';
export { LockoutService }  from './services/lockout.service';
export { MfaService }      from './services/mfa.service';

// ── Domain flow services ────────────────────────────────────────────────────
export { RegisterService }           from './services/register.service';
export { LoginService }              from './services/login.service';
export { LogoutService }             from './services/logout.service';
export { EmailVerificationService }  from './services/email-verification.service';
export { PasswordResetService }      from './services/password-reset.service';
export { CurrentUserService }        from './services/current-user.service';

// ── Guards ──────────────────────────────────────────────────────────────────
export { JwtAuthGuard }      from './guards/jwt-auth.guard';
export { RefreshTokenGuard } from './guards/refresh-token.guard';
export { LocalAuthGuard }    from './guards/local-auth.guard';
export { GoogleAuthGuard }   from './guards/google-auth.guard';
export { RolesGuard }        from './guards/roles.guard';

// ── Decorators ──────────────────────────────────────────────────────────────
export { CurrentUser }    from './decorators/current-user.decorator';
export { Public }         from './decorators/public.decorator';
export { Roles, type RoleSlug } from './decorators/roles.decorator';
export { RequiresTier, type SubscriptionTierRequired } from './decorators/requires-tier.decorator';

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  AuthenticatedUser,
  JwtAccessPayload,
  JwtRefreshPayload,
  TokenPair,
  CachedRolePermissions,
  TokenType,
  TierRequirement,
} from './auth.types';

// ── Constants ────────────────────────────────────────────────────────────────
export {
  JWT_STRATEGY,
  JWT_REFRESH_STRATEGY,
  LOCAL_STRATEGY,
  GOOGLE_STRATEGY,
  IS_PUBLIC_KEY,
  ROLES_KEY,
  REQUIRES_TIER_KEY,
  REFRESH_TOKEN_COOKIE,
  AUTH_ERROR_CODES,
  type AuthErrorCode,
} from './auth.constants';

// ── DTOs and Schemas ─────────────────────────────────────────────────────────
export {
  RegisterSchema,    type RegisterDto,
  LoginSchema,       type LoginDto,
  VerifyEmailSchema, type VerifyEmailDto,
  ResendVerificationSchema, type ResendVerificationDto,
  ForgotPasswordSchema, type ForgotPasswordDto,
  ResetPasswordSchema,  type ResetPasswordDto,
  ChangePasswordSchema, type ChangePasswordDto,
  MfaVerifySchema,   type MfaVerifyDto,
  MfaDisableSchema,  type MfaDisableDto,
  // Swagger classes
  RegisterDtoClass,
  LoginDtoClass,
  ForgotPasswordDtoClass,
  ResetPasswordDtoClass,
  VerifyEmailDtoClass,
  ChangePasswordDtoClass,
  ResendVerificationDtoClass,
  // Response classes
  RegisterResponseDto,
  LoginResponseDto,
  RefreshResponseDto,
  MessageResponseDto,
  LogoutAllResponseDto,
  AuthUserResponseDto,
  MfaSetupResponseDto,
} from './auth.dto';

// ── Utilities ────────────────────────────────────────────────────────────────
export { setRefreshTokenCookie, clearRefreshTokenCookie, extractRefreshTokenFromCookies } from './utils/cookie.utils';
export { hashToken, generateSecureToken, isExpired, calculateExpiry, generateTokenFamily } from './utils/token.utils';
export { validatePasswordStrength, isSamePassword } from './utils/password.utils';
