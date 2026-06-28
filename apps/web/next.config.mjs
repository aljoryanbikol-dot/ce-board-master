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
  // Production security headers. The Content-Security-Policy is set per-request
  // in middleware.ts (it needs a fresh nonce each request so Next.js can nonce
  // its inline hydration scripts); the static headers below are request-agnostic.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
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
