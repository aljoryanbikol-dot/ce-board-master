/**
 * @file cookie.utils.ts
 * @module Auth/Utils
 *
 * Utility functions for refresh-token cookie management in Fastify.
 *
 * These helpers abstract the Fastify response API for setting and clearing
 * the refresh-token httpOnly cookie. They are used by the AuthController
 * in Sprint 2.2 and can be easily mocked in tests.
 *
 * @see config/cookie.config.ts for the cookie option definitions
 */
import type { FastifyReply } from 'fastify';
import '@fastify/cookie'; // activates FastifyReply.setCookie / FastifyRequest.cookies type augmentation
import {
  getClearRefreshTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from '../config/cookie.config';
import { REFRESH_TOKEN_COOKIE } from '../auth.constants';

/**
 * Set the refresh-token httpOnly cookie on the Fastify response.
 *
 * @param reply - Fastify reply object
 * @param rawToken - The raw refresh token value (before hashing)
 * @param isProduction - Whether to set the Secure flag
 */
export function setRefreshTokenCookie(
  reply: FastifyReply,
  rawToken: string,
  isProduction: boolean,
): void {
  const options = getRefreshTokenCookieOptions(isProduction);
  void reply.setCookie(REFRESH_TOKEN_COOKIE, rawToken, options);
}

/**
 * Clear the refresh-token cookie (used on logout).
 * Sets maxAge=0 to instruct the browser to delete immediately.
 *
 * @param reply - Fastify reply object
 * @param isProduction - Whether to set the Secure flag
 */
export function clearRefreshTokenCookie(
  reply: FastifyReply,
  isProduction: boolean,
): void {
  const options = getClearRefreshTokenCookieOptions(isProduction);
  void reply.setCookie(REFRESH_TOKEN_COOKIE, '', options);
}

/**
 * Extract the refresh token value from a Fastify request's cookies.
 * Returns undefined if the cookie is absent (not set or already expired).
 *
 * @param cookies - The parsed cookies object from the Fastify request
 * @returns The raw refresh token string, or undefined
 */
export function extractRefreshTokenFromCookies(
  cookies: Record<string, string>,
): string | undefined {
  return cookies[REFRESH_TOKEN_COOKIE];
}
