/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output: produces a self-contained server bundle for a minimal
  // production Docker image (only the files needed to run, no full node_modules).
  output: 'standalone',
  // The monorepo root is two levels up; tracing from there bundles workspace deps.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  transpilePackages: ['@ce-board-master/types', '@ce-board-master/utils'],
  async rewrites() {
    // Single source of truth for the backend origin. Set API_PROXY_TARGET in the
    // Vercel project env to the deployed backend (e.g. https://ceboard-api.onrender.com).
    // Falls back to the local backend in dev. The browser always calls the
    // same-origin path /api/backend/* and Next proxies it server-side, so the
    // httpOnly refresh cookie stays first-party.
    const apiBase = process.env.API_PROXY_TARGET || 'http://localhost:3001';
    return [{ source: '/api/backend/:path*', destination: `${apiBase}/api/v1/:path*` }];
  },
  experimental: { optimizePackageImports: ['lucide-react', 'recharts'] },
  poweredByHeader: false,
  // Production security headers.
  // CSP note: 'unsafe-inline' is required on script-src because Next.js (App
  // Router) emits inline hydration/RSC scripts and most pages are statically
  // prerendered — a nonce can only be applied to dynamically rendered pages, so
  // a nonce-based policy would block the static pages and break hydration. All
  // other directives stay strict (object-src none, base-uri self, frame-ancestors
  // none, etc.). 'unsafe-eval' is intentionally omitted (not needed in prod).
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://fonts.googleapis.com",
      "manifest-src 'self'",
      'upgrade-insecure-requests',
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};
export default nextConfig;
