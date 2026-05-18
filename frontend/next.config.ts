import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function resolveBackendUrl() {
  if (process.env.BACKEND_INTERNAL_URL) {
    return process.env.BACKEND_INTERNAL_URL;
  }

  const port = process.env.BACKEND_PORT ?? '8080';
  return `http://gestop.railway.internal:${port}`;
}

const nextConfig: NextConfig = {
  turbopack: {
    root: rootDir,
  },
  async rewrites() {
    const apiUrl = resolveBackendUrl();
    console.log(`[GestOP:frontend] Proxy /api-gestop -> ${apiUrl}`);

    return [
      {
        source: '/api-gestop/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
