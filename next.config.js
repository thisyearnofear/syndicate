/** @type {import('next').NextConfig} */
const path = require('path');

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

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        'worker_threads': false,
      };
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // Mark problematic viem test modules as external
    if (!Array.isArray(config.externals)) {
      config.externals = [config.externals];
    }
    config.externals.push({
      'viem/_esm/clients/decorators/test': 'empty',
      'viem/_cjs/clients/decorators/test': 'empty',
      'viem/_esm/actions/test': 'empty',
      'viem/_cjs/actions/test': 'empty',
    });

    // Add warnings to ignore EISDIR errors from problematic imports
    config.ignoreWarnings = config.ignoreWarnings || [];
    config.ignoreWarnings.push({
      module: /viem/,
      message: /EISDIR/,
    });
    config.ignoreWarnings.push({
      module: /@base-org|@coinbase|@wagmi/,
      message: /EISDIR/,
    });

    // Alias problematic modules and test directories to the empty module
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve.alias,
        // Explicitly ignore test files that may be imported
        'thread-stream/test': path.resolve(__dirname, 'empty-module/index.js'),
        'thread-stream/test/': path.resolve(__dirname, 'empty-module/index.js'),
        // Viem test decorators
        'viem/_esm/clients/decorators/test.js': path.resolve(__dirname, 'empty-module/index.js'),
        'viem/_cjs/clients/decorators/test.js': path.resolve(__dirname, 'empty-module/index.js'),
        'viem/_esm/actions/test': path.resolve(__dirname, 'empty-module/index.js'),
        'viem/_cjs/actions/test': path.resolve(__dirname, 'empty-module/index.js'),
      },
    };

    // Add rules to ignore test files and problematic directories during webpack compilation
    config.module.rules = config.module.rules || [];
    config.module.rules.push(
      {
        test: /\.test\.(js|ts)$/,
        use: {
          loader: require.resolve('null-loader'),
        },
      },
      {
        test: /\.spec\.(js|ts)$/,
        use: {
          loader: require.resolve('null-loader'),
        },
      },
      {
        test: /node_modules\/.*\/test\/.*\.(js|ts)$/,
        use: {
          loader: require.resolve('null-loader'),
        },
      },
      {
        test: /node_modules\/(tap|tape|desm|fastbench|pino-elasticsearch|why-is-node-running|thread-stream)/,
        use: {
          loader: require.resolve('null-loader'),
        },
      }
    );

    return config;
  },
};

module.exports = nextConfig;
