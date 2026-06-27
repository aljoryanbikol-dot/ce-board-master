/**
 * @file auth.config.ts
 * @module Auth/Config
 *
 * Injectable authentication configuration for the auth module.
 *
 * Services and the controller inject AuthConfig instead of ConfigService
 * directly to:
 * - Keep a clean boundary (auth consumers don't depend on full AppEnvironment)
 * - Make unit testing trivial (mock one class, not all of ConfigService)
 * - Centralise all auth-related env variable access in one place
 *
 * FIX (Audit BUG-2): Added `frontendUrl` so the controller no longer
 * accesses process.env['FRONTEND_URL'] directly.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../../config/configuration';

@Injectable()
export class AuthConfig {
  readonly jwtPrivateKey: string;
  readonly jwtPublicKey: string;
  /** Access token expiry in seconds (default: 900 = 15 minutes) */
  readonly accessTokenTtl: number;
  /** Refresh token expiry in seconds (default: 2,592,000 = 30 days) */
  readonly refreshTokenTtl: number;
  readonly argon2Pepper: string;
  /** true when NODE_ENV === 'production'; drives Secure cookie flag */
  readonly isProduction: boolean;
  /** Frontend base URL — used in Google OAuth callback redirect */
  readonly frontendUrl: string;

  constructor(configService: ConfigService<AppEnvironment>) {
    this.jwtPrivateKey = configService
      .get('JWT_PRIVATE_KEY', { infer: true })!
      .replace(/\\n/g, '\n');

    this.jwtPublicKey = configService
      .get('JWT_PUBLIC_KEY', { infer: true })!
      .replace(/\\n/g, '\n');

    this.accessTokenTtl  = configService.get('JWT_ACCESS_TOKEN_EXPIRES_IN', { infer: true })!;
    this.refreshTokenTtl = configService.get('JWT_REFRESH_TOKEN_EXPIRES_IN', { infer: true })!;
    this.argon2Pepper    = configService.get('ARGON2_PEPPER', { infer: true })!;
    this.frontendUrl     = configService.get('FRONTEND_URL', { infer: true })!;
    this.isProduction    = configService.get('NODE_ENV', { infer: true }) === 'production';
  }
}
