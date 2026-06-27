/**
 * @file cookie.config.ts
 * @module Auth/Config
 *
 * Refresh-token cookie configuration for CE Board Master.
 *
 * Security requirements (Project Constitution Article XI §11):
 * - httpOnly: JavaScript cannot read the cookie (XSS protection)
 * - Secure: Transmitted only over HTTPS
 * - SameSite=Strict: No cross-origin request sends the cookie (CSRF protection)
 * - Path restricted to the refresh endpoint only
 *
 * Path restriction: Setting Path=/api/v1/auth/refresh ensures the browser
 * only sends the refresh token cookie to that specific path. All other API
 * calls never include the refresh token, reducing its exposure surface.
 */

/** Cookie serialize options type (Fastify-compatible) */
export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge?: number;
  expires?: Date;
}

/**
 * Returns cookie options for setting the refresh token.
 * @param isProduction - When false, Secure flag is omitted (localhost HTTP)
 */
export function getRefreshTokenCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
    // 30 days in seconds — matches JWT_REFRESH_TOKEN_EXPIRES_IN default
    maxAge: 30 * 24 * 60 * 60,
  };
}

/**
 * Cookie options to CLEAR the refresh token on logout.
 * maxAge=0 instructs the browser to delete the cookie immediately.
 */
export function getClearRefreshTokenCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
    maxAge: 0,
    expires: new Date(0),
  };
}
