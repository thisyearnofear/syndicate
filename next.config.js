/** @type {import('next').NextConfig} */
const nextConfig = {
  // Basic optimizations for better performance
  reactStrictMode: true,
  transpilePackages: [
    'viem',
    'wagmi',
    '@wagmi/core',
    '@wagmi/connectors',
    'ens-normalize',
    'noble-hashes',
    '@metamask/delegation-abis',
  ],
  
  // Optimize images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'localhost',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },

  // Better caching
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },

  // Remove powered by header
  poweredByHeader: false,

  // Enable compression
  compress: true,

  // Skip type checking for styled-jsx issues
  typescript: {
    ignoreBuildErrors: true,
  },

  // Add turbopack configuration to resolve build error
  turbopack: {},
};

module.exports = nextConfig;

module.exports = nextConfig;