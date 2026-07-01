/**
 * @file auth.module.ts
 * @module Auth
 *
 * Authentication module — complete for Sprint 2.2.
 *
 * Service registration follows the Clean Architecture layering:
 * Each flow (Register, Login, Logout, etc.) has its own dedicated service
 * rather than all logic living in a single monolithic AuthService.
 *
 * AuthService is retained for Passport strategy support:
 * - validateCredentials() — called by LocalStrategy
 * - getUserFromJwtPayload() — called by JwtStrategy on every request
 * - getPermissionsForRole() — called by RolesGuard
 *
 * Global guard registration:
 * JwtAuthGuard is registered as APP_GUARD in AppModule.
 * It is NOT registered here — doing so in both places would double-apply it.
 */
import { Module } from '@nestjs/common';
import { JwtModule }      from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

// Config
import { AuthConfig }   from './config/auth.config';
import { jwtConfig }    from './config/jwt.config';

// Infrastructure services (Sprint 2.1)
import { AuthService }      from './services/auth.service';
import { PasswordService }  from './services/password.service';
import { TokenService }     from './services/token.service';
import { EmailService }     from './services/email.service';
import { LockoutService }   from './services/lockout.service';
import { MfaService }       from './services/mfa.service';
import { SubscriptionTierResolverService } from './services/subscription-tier-resolver.service';

// Domain flow services (Sprint 2.2)
import { RegisterService }           from './services/register.service';
import { LoginService }              from './services/login.service';
import { LogoutService }             from './services/logout.service';
import { EmailVerificationService }  from './services/email-verification.service';
import { PasswordResetService }      from './services/password-reset.service';
import { CurrentUserService }        from './services/current-user.service';

// Passport strategies
import { JwtStrategy }        from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { LocalStrategy }      from './strategies/local.strategy';
import { GoogleStrategy }     from './strategies/google.strategy';
import { PrismaService }      from '../database/prisma.service';

// Guards
import { JwtAuthGuard }      from './guards/jwt-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { LocalAuthGuard }    from './guards/local-auth.guard';
import { GoogleAuthGuard }   from './guards/google-auth.guard';
import { RolesGuard }        from './guards/roles.guard';
import { SubscriptionGuard } from './guards/subscription.guard';

// Controller
import { AuthController } from './auth.controller';

// Shared
import { QUEUE_NAMES }    from '../queue/queue.module';
import type { AppEnvironment } from '../config/configuration';

@Module({
  imports: [
    PassportModule.register({}),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cs: ConfigService<AppEnvironment>) => jwtConfig(cs),
      inject: [ConfigService],
    }),

    // Email queue (registration + verification + reset emails)
    BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }),
  ],

  controllers: [AuthController],

  providers: [
    // ── Configuration wrapper ─────────────────────────────────────────────────
    AuthConfig,

    // ── Infrastructure services ───────────────────────────────────────────────
    AuthService,       // Passport strategy support (validate credentials, JWT user load, RBAC)
    PasswordService,   // Argon2id hash + verify
    TokenService,      // JWT + refresh token lifecycle
    EmailService,      // BullMQ email enqueue
    LockoutService,    // Redis sliding-window lockout
    MfaService,        // TOTP + backup codes
    SubscriptionTierResolverService, // resolves the live subscription tier for JWT claims

    // ── Domain flow services (Sprint 2.2) ─────────────────────────────────────
    RegisterService,           // POST /auth/register
    LoginService,              // POST /auth/login
    LogoutService,             // POST /auth/logout + /auth/logout-all
    EmailVerificationService,  // POST /auth/verify-email + /auth/resend-verification
    PasswordResetService,      // POST /auth/forgot-password + /auth/reset-password + PATCH /auth/change-password
    CurrentUserService,        // GET /auth/me

    // ── Passport strategies ───────────────────────────────────────────────────
    JwtStrategy,
    JwtRefreshStrategy,
    LocalStrategy,
    // Google OAuth is optional: passport-google-oauth20 throws if clientID is
    // missing, so only register the strategy when GOOGLE_CLIENT_ID is set.
    // When unconfigured the /auth/google routes are simply inactive.
    {
      provide: GoogleStrategy,
      useFactory: (config: ConfigService<AppEnvironment>, prisma: PrismaService, tierResolver: SubscriptionTierResolverService) => {
        const clientId = config.get('GOOGLE_CLIENT_ID', { infer: true });
        return clientId ? new GoogleStrategy(config, prisma, tierResolver) : null;
      },
      inject: [ConfigService, PrismaService, SubscriptionTierResolverService],
    },

    // ── Guards ────────────────────────────────────────────────────────────────
    JwtAuthGuard,
    RefreshTokenGuard,
    LocalAuthGuard,
    GoogleAuthGuard,
    RolesGuard,
    SubscriptionGuard,
  ],

  exports: [
    // Infrastructure services used by other modules
    AuthService,
    PasswordService,
    TokenService,
    MfaService,
    SubscriptionTierResolverService,

    // Guards for explicit @UseGuards() decoration
    JwtAuthGuard,
    RefreshTokenGuard,
    RolesGuard,
    SubscriptionGuard,

    // JwtModule exports JwtService for external use
    JwtModule,
  ],
})
export class AuthModule {}
