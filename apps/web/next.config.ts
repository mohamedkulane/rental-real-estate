import type { NextConfig } from 'next';

const configuredApiUrl = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const apiBaseUrl = configuredApiUrl.endsWith('/')
  ? configuredApiUrl.slice(0, -1)
  : configuredApiUrl;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};
export default nextConfig;
