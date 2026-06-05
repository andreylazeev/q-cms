/**
 * Next.js configuration for the Q-CMS Admin UI.
 *
 * - `output: 'standalone'` for minimal Docker images.
 * - Server actions accept up to 10mb payloads (media uploads).
 * - All `@q-cms/*` workspace packages are transpiled so that
 *   TS source is consumed directly during dev/build.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  transpilePackages: [
    '@q-cms/ui',
    '@q-cms/editor',
    '@q-cms/api-client',
    '@q-cms/core',
    '@q-cms/sdk',
  ],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
