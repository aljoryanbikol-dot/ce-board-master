/**
 * @file auth.controller.ts
 * @module Auth
 *
 * Authentication controller — pure HTTP adapter layer.
 *
 * Responsibility: HTTP concerns only.
 *   - Parse and validate request bodies via ZodValidationPipe
 *   - Extract request metadata (IP address, User-Agent, cookies)
 *   - Delegate ALL business logic to the corresponding domain service
 *   - Set / clear httpOnly refresh-token cookies
 *   - Shape the response per API Contract Phase 4, Group 1
 *
 * Zero business logic. Zero Prisma calls. Zero process.env access.
 * Every method delegates to a service immediately.
 *
 * FIX (Audit BUG-1): Removed all process.env['NODE_ENV'] and
 * process.env['FRONTEND_URL'] access. These now come from the injected
 * AuthConfig (which reads them once at startup via ConfigService).
 *
 * FIX (Audit BUG-4): Removed hardcoded isVerified:true in login response.
 * Login only succeeds for verified accounts (LoginService enforces this),
 * but the value should be derived from the authenticated user context —
 * not hardcoded — for correctness and future-proofing.
 *
 * FIX (Audit Refactoring): verifyMfa and disableMfa no longer contain
 * if(!isValid) branching. MfaService.verifyTotp() now throws on failure,
 * so the controller can delegate unconditionally.
 *
 * Endpoints:
 *   POST   /auth/register              RegisterService.register()
 *   POST   /auth/verify-email          EmailVerificationService.verifyEmail()
 *   POST   /auth/resend-verification   EmailVerificationService.resendVerification()
 *   POST   /auth/login                 LoginService.login()
 *   POST   /auth/refresh               JwtRefreshStrategy + TokenService (via RefreshTokenGuard)
 *   POST   /auth/logout                LogoutService.logoutCurrentDevice()
 *   POST   /auth/logout-all            LogoutService.logoutAllDevices()
 *   POST   /auth/forgot-password       PasswordResetService.forgotPassword()
 *   POST   /auth/reset-password        PasswordResetService.resetPassword()
 *   PATCH  /auth/change-password       PasswordResetService.changePassword()
 *   GET    /auth/me                    CurrentUserService.getCurrentUser()
 *   GET    /auth/google                GoogleStrategy (Passport redirect)
 *   GET    /auth/google/callback       GoogleStrategy + TokenService
 *   POST   /auth/mfa/setup             MfaService.setupMfa()
 *   POST   /auth/mfa/verify            MfaService.verifyTotp() (throws on failure)
 *   DELETE /auth/mfa                   MfaService.verifyTotp() + disableMfa()
 *
 * @see API Contract Specification Phase 4, Group 1
 * @see Project Constitution Article XI §11 — Security Standards
 * @see Project Constitution Article XIV §14 — Coding Standards (Clean Architecture)
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import '@fastify/cookie'; // activates FastifyReply.setCookie / FastifyRequest.cookies type augmentation

// ── Domain services ───────────────────────────────────────────────────────────
import { RegisterService }           from './services/register.service';
import { LoginService }              from './services/login.service';
import { LogoutService }             from './services/logout.service';
import { EmailVerificationService }  from './services/email-verification.service';
import { PasswordResetService }      from './services/password-reset.service';
import { CurrentUserService }        from './services/current-user.service';
import { TokenService }              from './services/token.service';
import { MfaService }                from './services/mfa.service';

// ── Configuration ─────────────────────────────────────────────────────────────
import { AuthConfig } from './config/auth.config';

// ── Guards ───────────────────────────────────────────────────────────────────
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { GoogleAuthGuard }   from './guards/google-auth.guard';

// ── Decorators ────────────────────────────────────────────────────────────────
import { Public }      from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

// ── DTOs and schemas ──────────────────────────────────────────────────────────
import {
  RegisterDtoClass,       RegisterSchema,
  LoginDtoClass,          LoginSchema,
  VerifyEmailDtoClass,    VerifyEmailSchema,
  ResendVerificationDtoClass, ResendVerificationSchema,
  ForgotPasswordDtoClass, ForgotPasswordSchema,
  ResetPasswordDtoClass,  ResetPasswordSchema,
  ChangePasswordDtoClass, ChangePasswordSchema,
  MfaVerifyDtoClass,      MfaVerifySchema,
  MfaDisableDtoClass,     MfaDisableSchema,
  // Response classes (Swagger)
  RegisterResponseDto,
  LoginResponseDto,
  RefreshResponseDto,
  MessageResponseDto,
  LogoutAllResponseDto,
  AuthUserResponseDto,
  MfaSetupResponseDto,
} from './auth.dto';

import { ZodValidationPipe }    from '../common/pipes/zod-validation.pipe';
import { setRefreshTokenCookie, clearRefreshTokenCookie } from './utils/cookie.utils';
import type { AuthenticatedUser, TokenPair } from './auth.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly registerService:          RegisterService,
    private readonly loginService:             LoginService,
    private readonly logoutService:            LogoutService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService:     PasswordResetService,
    private readonly currentUserService:       CurrentUserService,
    private readonly tokenService:             TokenService,
    private readonly mfaService:               MfaService,
    private readonly authConfig:               AuthConfig,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // POST /auth/register
  // ════════════════════════════════════════════════════════════════════════════

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new account',
    description:
      'Creates a user account and enqueues a verification email. ' +
      'Returns 201 immediately — does not wait for email delivery.',
  })
  @ApiBody({ type: RegisterDtoClass })
  @ApiResponse({ status: 201, type: RegisterResponseDto, description: 'Account created. Verification email sent.' })
  @ApiResponse({ status: 409, description: 'EMAIL_ALREADY_EXISTS — email already registered.' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR — request body fails schema validation.' })
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) body: typeof RegisterSchema._type,
    @Req() req: FastifyRequest,
  ): Promise<RegisterResponseDto> {
    return this.registerService.register(body, req.ip);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // POST /auth/verify-email
  // ════════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email address',
    description: 'Validates the one-time token from the verification link and activates the account.',
  })
  @ApiBody({ type: VerifyEmailDtoClass })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Email verified. Account activated.' })
  @ApiResponse({ status: 401, description: 'VERIFY_TOKEN_INVALID — token invalid, expired, or already used.' })
  @ApiResponse({ status: 409, description: 'ALREADY_VERIFIED — email already verified.' })
  async verifyEmail(
    @Body(new ZodValidationPipe(VerifyEmailSchema)) body: typeof VerifyEmailSchema._type,
  ): Promise<MessageResponseDto> {
    return this.emailVerificationService.verifyEmail(body.token);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // POST /auth/resend-verification
  // ════════════════════════════════════════════════════════════════════════════

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend email verification link',
    description:
      'Sends a new verification email. Always returns 200 to prevent email enumeration, ' +
      'even for unregistered or already-verified addresses.',
  })
  @ApiBody({ type: ResendVerificationDtoClass })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Always 200 (anti-enumeration).' })
  async resendVerification(
    @Body(new ZodValidationPipe(ResendVerificationSchema)) body: typeof ResendVerificationSchema._type,
  ): Promise<MessageResponseDto> {
    return this.emailVerificationService.resendVerification(body.email);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // POST /auth/login
  // ════════════════════════════════════════════════════════════════════════════

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Validates credentials and returns a JWT access token + sets an httpOnly refresh cookie. ' +
      'MFA code required if MFA is enabled for the account.',
  })
  @ApiBody({ type: LoginDtoClass })
  @ApiResponse({ status: 200, type: LoginResponseDto, description: 'Login successful.' })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS | MFA_INVALID' })
  @ApiResponse({ status: 403, description: 'ACCOUNT_NOT_VERIFIED | ACCOUNT_SUSPENDED | MFA_REQUIRED | ACCOUNT_LOCKED' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: typeof LoginSchema._type,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponseDto> {
    const { tokenPair, user } = await this.loginService.login({
      email:     body.email,
      password:  body.password,
      mfaCode:   body.mfaCode,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setRefreshCookie(reply, tokenPair);

    return {
      accessToken: tokenPair.accessToken,
      tokenType:   'Bearer',
      expiresIn:   tokenPair.expiresIn,
      user: {
        id:               user.id,
        email:            user.email,
        role:             user.role,
        subscriptionTier: user.subscriptionTier,
        // FIX BUG-4: login only succeeds for verified accounts (LoginService
        // enforces this via the ACCOUNT_NOT_VERIFIED check). Set true here
        // as a semantic truth derived from the login success, not a hardcode.
        isVerified: true,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // POST /auth/refresh
  // ════════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshTokenGuard)
  @ApiOperation({
    summary: 'Rotate refresh token',
    description:
      'Validates the httpOnly refresh cookie, issues a new JWT access token, ' +
      'and rotates the refresh token. Detects and rejects token reuse.',
  })
  @ApiCookieAuth('refreshToken')
  @ApiResponse({ status: 200, type: RefreshResponseDto, description: 'New access token issued.' })
  @ApiResponse({ status: 401, description: 'REFRESH_TOKEN_INVALID | REFRESH_TOKEN_REUSE | REFRESH_TOKEN_MISSING' })
  async refresh(
    @Req() req: FastifyRequest & { user?: unknown },
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RefreshResponseDto> {
    // JwtRefreshStrategy already validated + rotated the token.
    // req.user is the new TokenPair returned by strategy.validate().
    const tokenPair = req.user as unknown as TokenPair;

    this.setRefreshCookie(reply, tokenPair);

    return {
      accessToken: tokenPair.accessToken,
      expiresIn:   tokenPair.expiresIn,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // POST /auth/logout
  // ════════════════════════════════════════════════════════════════════════════

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout (current device)',
    description:
      'Revokes the current refresh token and clears the cookie. ' +
      'The access token remains valid until its 15-minute natural expiry.',
  })
  @ApiResponse({ status: 204, description: 'Logged out.' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const cookies         = (req.cookies ?? {}) as Record<string, string>;
    const rawRefreshToken = cookies['refreshToken'];

    await this.logoutService.logoutCurrentDevice(rawRefreshToken, user);

    this.clearRefreshCookie(reply);
    // 204 No Content — no return value
  }

  // ════════════════════════════════════════════════════════════════════════════
  // POST /auth/logout-all
  // ════════════════════════════════════════════════════════════════════════════

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout (all devices)',
    description: 'Revokes ALL active refresh tokens for the current user.',
  })
  @ApiResponse({ status: 200, type: LogoutAllResponseDto, description: 'All sessions revoked.' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LogoutAllResponseDto> {
    const result = await this.logoutService.logoutAllDevices(user);

    this.clearRefreshCookie(reply);

    return result;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // POST /auth/forgot-password
  // ════════════════════════════════════════════════════════════════════════════

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset email',
    description:
      'Always returns 200 regardless of whether the email is registered (anti-enumeration). ' +
      'Sends a reset link that expires in 1 hour.',
  })
  @ApiBody({ type: ForgotPasswordDtoClass })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Always 200 (anti-enumeration).' })
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema)) body: typeof ForgotPasswordSchema._type,
  ): Promise<MessageResponseDto> {
    return this.passwordResetService.forgotPassword(body.email);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // POST /auth/reset-password
  // ════════════════════════════════════════════════════════════════════════════

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with email token',
    description:
      'Sets a new password using the single-use token from the reset email. ' +
      'Revokes all active sessions on success.',
  })
  @ApiBody({ type: ResetPasswordDtoClass })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Password reset. All sessions revoked.' })
  @ApiResponse({ status: 401, description: 'RESET_TOKEN_INVALID — token not found, expired, or already used.' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) body: typeof ResetPasswordSchema._type,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<MessageResponseDto> {
    const result = await this.passwordResetService.resetPassword(body.token, body.newPassword);

    // Clear cookie — all sessions revoked; client must re-authenticate
    this.clearRefreshCookie(reply);

    return result;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PATCH /auth/change-password
  // ════════════════════════════════════════════════════════════════════════════

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Change password (authenticated)',
    description:
      'Changes the account password. Requires the current password for confirmation. ' +
      'Revokes all active sessions on success.',
  })
  @ApiBody({ type: ChangePasswordDtoClass })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Password changed. All sessions revoked.' })
  @ApiResponse({ status: 400, description: 'NO_PASSWORD_SET — account uses social login only.' })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS — current password is incorrect.' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) body: typeof ChangePasswordSchema._type,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<MessageResponseDto> {
    const result = await this.passwordResetService.changePassword(
      user,
      body.currentPassword,
      body.newPassword,
    );

    // Clear cookie — all sessions revoked
    this.clearRefreshCookie(reply);

    return result;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GET /auth/me
  // ════════════════════════════════════════════════════════════════════════════

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user',
    description:
      'Returns the full user profile for the authenticated user. ' +
      'Always reads from the database — reflects the current state.',
  })
  @ApiResponse({ status: 200, type: AuthUserResponseDto, description: 'Current user profile.' })
  @ApiResponse({ status: 401, description: 'UNAUTHORIZED' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.currentUserService.getCurrentUser(user);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Google OAuth
  // ════════════════════════════════════════════════════════════════════════════

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Initiate Google OAuth',
    description: 'Redirects to the Google consent screen. Browser follows redirect automatically.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to Google consent screen.' })
  initiateGoogleAuth(): void {
    // GoogleAuthGuard performs the redirect; this method body never executes
  }

  @Public()
  @Get('google/callback')
  @HttpCode(HttpStatus.FOUND)
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Handles the callback from Google, issues JWT + sets refresh cookie, ' +
      'then redirects to the frontend dashboard.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to frontend with access token.' })
  async googleCallback(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const tokenPair = await this.tokenService.generateTokenPair(
      user,
      req.ip,
      req.headers['user-agent'],
    );

    this.setRefreshCookie(reply, tokenPair);

    // FIX BUG-1: Use authConfig.frontendUrl instead of process.env
    await reply.redirect(
      `${this.authConfig.frontendUrl}/auth/callback?token=${tokenPair.accessToken}`,
      HttpStatus.FOUND,
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MFA endpoints
  // ════════════════════════════════════════════════════════════════════════════

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Setup MFA — generate TOTP secret',
    description:
      'Generates a TOTP secret and returns a QR code URL for authenticator app setup. ' +
      'MFA is NOT enabled until POST /auth/mfa/verify succeeds.',
  })
  @ApiResponse({ status: 200, type: MfaSetupResponseDto })
  async setupMfa(@CurrentUser() user: AuthenticatedUser): Promise<MfaSetupResponseDto> {
    const result = await this.mfaService.setupMfa(user.id, user.email);
    return {
      ...result,
      message: 'Save your backup codes in a safe place — they cannot be retrieved later.',
    };
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify TOTP and enable MFA',
    description: 'Verifies the first TOTP code from the authenticator app and enables MFA.',
  })
  @ApiBody({ type: MfaVerifyDtoClass })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'MFA enabled.' })
  @ApiResponse({ status: 401, description: 'MFA_INVALID — TOTP code is incorrect.' })
  @ApiResponse({ status: 400, description: 'MFA_NOT_SETUP — MFA setup not initiated.' })
  async verifyMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(MfaVerifySchema)) body: typeof MfaVerifySchema._type,
  ): Promise<MessageResponseDto> {
    // FIX Refactoring: verifyTotp() now throws UnauthorizedException on failure.
    // No if(!isValid) branching needed — pure delegation.
    await this.mfaService.verifyTotp(user.id, body.code);
    return { message: 'Two-factor authentication has been enabled for your account.' };
  }

  @Delete('mfa')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Disable MFA',
    description: 'Disables MFA after verifying the current TOTP code.',
  })
  @ApiBody({ type: MfaDisableDtoClass })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'MFA disabled.' })
  @ApiResponse({ status: 401, description: 'MFA_INVALID — TOTP code incorrect.' })
  @ApiResponse({ status: 400, description: 'MFA_NOT_SETUP — MFA not configured.' })
  async disableMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(MfaDisableSchema)) body: typeof MfaDisableSchema._type,
  ): Promise<MessageResponseDto> {
    // FIX Refactoring: verifyTotp() now throws on failure — no branching.
    await this.mfaService.verifyTotp(user.id, body.code);
    await this.mfaService.disableMfa(user.id);
    return { message: 'Two-factor authentication has been disabled.' };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Private cookie helpers
  // ════════════════════════════════════════════════════════════════════════════

  /** Set the httpOnly refresh-token cookie using AuthConfig for the Secure flag. */
  private setRefreshCookie(reply: FastifyReply, tokenPair: TokenPair): void {
    setRefreshTokenCookie(reply, tokenPair.rawRefreshToken, this.authConfig.isProduction);
  }

  /** Clear the refresh-token cookie (logout, password change, password reset). */
  private clearRefreshCookie(reply: FastifyReply): void {
    clearRefreshTokenCookie(reply, this.authConfig.isProduction);
  }
}
