/**
 * @file jwt.config.ts
 * @module Auth/Config
 *
 * JWT configuration factory for @nestjs/jwt.
 *
 * Algorithm: RS256 (RSA asymmetric signing)
 *
 * Why RS256 over HS256?
 * - Private key (signs tokens) lives only in the API
 * - Public key (verifies tokens) can be shared safely with other services
 * - Compromise of the public key cannot forge tokens
 * - Future microservices can verify tokens without sharing secrets
 *
 * Key generation (run once, store in AWS Secrets Manager):
 *   openssl genrsa -out private.pem 2048
 *   openssl rsa -in private.pem -pubout -out public.pem
 *
 * @see Software Architecture Phase 3B, Section 5 (Authentication Flow)
 * @see Project Constitution Article XI §11
 */
import { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import type { AppEnvironment } from '../../config/configuration';

/**
 * Factory that produces JwtModule configuration.
 * Injected into JwtModule.registerAsync() in auth.module.ts.
 */
export function jwtConfig(
  configService: ConfigService<AppEnvironment>,
): JwtModuleOptions {
  // Private key used for SIGNING access tokens (server only)
  const privateKey = configService
    .get('JWT_PRIVATE_KEY', { infer: true })!
    .replace(/\\n/g, '\n');

  // Public key used for VERIFYING access tokens
  const publicKey = configService
    .get('JWT_PUBLIC_KEY', { infer: true })!
    .replace(/\\n/g, '\n');

  const accessTokenTtl = configService.get('JWT_ACCESS_TOKEN_EXPIRES_IN', { infer: true });

  return {
    privateKey,
    publicKey,
    signOptions: {
      algorithm: 'RS256',
      expiresIn: accessTokenTtl,
      issuer: 'ce-board-master',
      audience: 'ce-board-master-students',
    },
    verifyOptions: {
      algorithms: ['RS256'],
      issuer: 'ce-board-master',
      audience: 'ce-board-master-students',
    },
  };
}
