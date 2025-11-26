/**
 * Next.js Configuration
 * Smart LeadMailer Pro v1
 * - Disables powered-by header for security
 * - Prevents API route caching (critical for live data)
 * - Adds basic security headers
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove "X-Powered-By: Next.js" header (security best practice)
  poweredByHeader: false,

  // Keep React Strict Mode in development only (performance in prod)
  reactStrictMode: process.env.NODE_ENV === 'development',

  // API routes must never be cached – we need live Firestore data
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },

  // Optional: Configure trailing slashes (false = /api/route, true = /api/route/)
  trailingSlash: false,
};

module.exports = nextConfig;
