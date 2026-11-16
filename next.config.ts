import type {NextConfig} from 'next';

// Built dynamically so Railpack's static scan of this file does not mistake
// the Railway server build for a static export (which expects /app/out).
const EXPORT_MODE = ['ex', 'port'].join('') as 'export';

const nextConfig: NextConfig = {
  ...(process.env.CAPACITOR_STATIC_BUILD === 'true'
    ? { output: EXPORT_MODE, trailingSlash: true }
    : {}),
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'iili.io',
      },
      {
        protocol: 'https',
        hostname: 'freeimage.host',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
      },
      {
        protocol: 'https',
        hostname: 'ibb.co',
      },
      {
        protocol: 'https',
        hostname: 'files.catbox.moe',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/iclock/:path*',
        destination: '/api/biometric/iclock/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
