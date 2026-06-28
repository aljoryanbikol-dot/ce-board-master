/**
 * @file middleware.ts
 *
 * Per-request Content-Security-Policy with a nonce.
 *
 * Next.js (App Router) injects inline <script> tags for hydration and the RSC
 * payload. A static `script-src 'self'` blocks them, so the page renders but
 * never becomes interactive. We generate a fresh nonce per request, advertise
 * it in the CSP, and hand it to Next via the request headers — Next then stamps
 * the same nonce on every script it emits, so they execute while arbitrary
 * injected/inline scripts stay blocked (XSS protection preserved).
 *
 * `'strict-dynamic'` lets scripts loaded by a nonced script (Next's chunk
 * loader) run too; browsers that don't support it fall back to `'self'`.
 */
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://fonts.googleapis.com",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

  // Pass the nonce + CSP to Next via request headers so it nonces its scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Run on all routes except Next static assets, image optimizer, and favicon.
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
