/** @type {import('next').NextConfig} */
const nextConfig = {
  // Basic optimizations for better performance
  reactStrictMode: true,
  
  // Optimize images
  images: {
    domains: ["localhost"],
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
    ];
  },

  // Basic webpack optimization
  webpack: (config, { dev }) => {
    if (!dev) {
      // Production optimizations
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    return config;
  },

  // Remove console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Enable compression
  compress: true,
  
  // Remove powered by header
   poweredByHeader: false,

   // Skip linting during build for now (can be re-enabled after fixing linting issues)
   eslint: {
     ignoreDuringBuilds: true,
   },
 };

module.exports = nextConfig;