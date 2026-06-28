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
 * - Path=/ so the cookie is sent on the same-origin requests the web app makes
 *
 * Path note: the web app reaches the API through a same-origin Next.js rewrite
 * (/api/backend/* → <api>/api/v1/*), so the browser calls the refresh endpoint
 * at /api/backend/auth/refresh — NOT /api/v1/auth/refresh. A cookie scoped to
 * the backend's own path would therefore never be sent on refresh (the browser
 * would log the user out on every reload). Path=/ ensures it is sent; HttpOnly +
 * Secure + SameSite=Strict still protect it.
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
    path: '/',
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
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
}
