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
        // Fix for MetaMask SDK trying to import react-native module
        '@react-native-async-storage/async-storage': path.resolve(__dirname, 'empty-module/index.js'),
        // Explicitly ignore test files that may be imported
        'thread-stream/test': path.resolve(__dirname, 'empty-module/index.js'),
        'thread-stream/test/': path.resolve(__dirname, 'empty-module/index.js'),
        // Viem test decorators - use empty module to avoid build errors
        'viem/_esm/clients/decorators/test.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_cjs/clients/decorators/test.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        // Also alias specific test action imports
        'viem/_esm/actions/test/dropTransaction.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/dumpState.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/getAutomine.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/getTxpoolContent.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/getTxpoolStatus.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/impersonateAccount.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/increaseTime.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/inspectTxpool.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/loadState.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/mine.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/removeBlockTimestampInterval.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/reset.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/revert.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/sendUnsignedTransaction.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setAutomine.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setBalance.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setBlockGasLimit.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setBlockTimestampInterval.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setCode.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setCoinbase.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setIntervalMining.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setLoggingEnabled.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setMinGasPrice.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setNextBlockBaseFeePerGas.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setNextBlockTimestamp.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setNonce.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setRpcUrl.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/setStorageAt.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/snapshot.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
        'viem/_esm/actions/test/stopImpersonatingAccount.js': path.resolve(__dirname, 'empty-module/viem-test.js'),
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