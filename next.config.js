/** @type {import('next').NextConfig} */
const path = require('path');
const webpack = require('webpack');

// ---------------------------------------------------------------------------
// Polyfill fetch.cache for Next.js 14 build
//
// Next.js 14's "Collecting page data" phase evaluates dynamic route modules
// even when they have `export const dynamic = 'force-dynamic'`. Some transitive
// dependencies (viem, ethers, etc.) call fetch.cache() which only exists in
// Next.js's patched fetch, not in Node.js's native fetch. This causes:
//   TypeError: n.cache is not a function
//
// We patch the global fetch to add a no-op .cache before Next.js gets to it,
// so when Next.js later patches fetch, it finds .cache already exists and
// doesn't break. This is safe — .cache is only meaningful during actual
// request handling, not during build-time module evaluation.
// ---------------------------------------------------------------------------
if (typeof globalThis.fetch?.cache !== 'function') {
  const originalFetch = globalThis.fetch;
  const noopCache = () => originalFetch;
  noopCache.forceCache = noopCache;
  noopCache.noStore = noopCache;
  noopCache.revalidate = () => noopCache;
  noopCache.life = () => noopCache;
  globalThis.fetch = Object.assign(function fetch(...args) {
    return originalFetch.apply(this, args);
  }, { cache: noopCache });
}

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

  // Skip ESLint during builds (ESLint config compatibility issue with ESLint 9)
  eslint: {
    ignoreDuringBuilds: true,
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

    // Replace ALL viem test decorator/action imports (any version, any pnpm path)
    // with empty module stubs. This catches both the top-level and nested copies.
    const viemTestStub = path.resolve(__dirname, 'empty-module/viem-test.js');
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /viem\/_esm\/(clients\/decorators\/test|actions\/test\/)\.?/,
        viemTestStub
      )
    );

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

    // Alias problematic modules
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve.alias,
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        '@react-native-async-storage/async-storage': path.resolve(__dirname, 'empty-module/index.js'),
        'thread-stream/test': path.resolve(__dirname, 'empty-module/index.js'),
        'thread-stream/test/': path.resolve(__dirname, 'empty-module/index.js'),
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