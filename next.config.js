/** @type {import('next').NextConfig} */
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const nextConfig = {
  // PERFORMANT: Enhanced build performance with aggressive optimizations
  experimental: {
    optimizePackageImports: [
      "@coordinationlabs/megapot-ui-kit",
      "@metamask/delegation-toolkit",
      "wagmi",
      "viem",
      "lucide-react",
    ],
    // Enable modern bundling for better performance
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
    // Additional optimizations from consolidated config
    optimizeCss: true,
    scrollRestoration: true,
  },

  // PERFORMANT: Enhanced webpack optimizations with blockchain-specific splitting
  webpack: (config, { dev, isServer }) => {
    // Development optimizations
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/.next'],
      };
      // Faster dev builds
      config.optimization.removeAvailableModules = false;
      config.optimization.removeEmptyChunks = false;
      config.optimization.splitChunks = false;
    }

    // PERFORMANT: Enhanced production optimizations with better chunk splitting
    if (!dev) {
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        cacheGroups: {
          // MODULAR: Separate blockchain SDKs for better caching
          ethereum: {
            test: /[\\/]node_modules[\\/](ethers|viem|wagmi|@metamask)/,
            name: 'ethereum',
            chunks: 'all',
            priority: 30,
            enforce: true,
          },
          solana: {
            test: /[\\/]node_modules[\\/](@solana|@bonfida)/,
            name: 'solana',
            chunks: 'all',
            priority: 30,
            enforce: true,
          },
          near: {
            test: /[\\/]node_modules[\\/](@near-js|near-api-js)/,
            name: 'near',
            chunks: 'all',
            priority: 30,
            enforce: true,
          },
          // PERFORMANT: Separate UI libraries
          ui: {
            test: /[\\/]node_modules[\\/](framer-motion|lucide-react|@coordinationlabs)/,
            name: 'ui',
            chunks: 'all',
            priority: 25,
          },
          // CLEAN: React and core dependencies
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)/,
            name: 'react',
            chunks: 'all',
            priority: 20,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            minChunks: 2,
          },
        },
      };
    }

    // CLEAN: Reduce bundle size with proper fallbacks
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
    };

    // PERFORMANT: Enhanced tree shaking and optimization
    if (!dev) {
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
      config.optimization.providedExports = true;
      config.optimization.innerGraph = true;
    }

    // PERFORMANT: Add bundle analyzer in production
    if (!dev && !isServer && process.env.ANALYZE === 'true') {
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: './bundle-analysis.html',
          openAnalyzer: true,
          defaultSizes: 'gzip',
          generateStatsFile: true,
          statsFilename: './bundle-stats.json',
          logLevel: 'info',
        })
      );
    }

    return config;
  },

  // MODULAR: Transpile packages for better compatibility
  transpilePackages: [
    "@coordinationlabs/megapot-ui-kit",
    "@metamask/delegation-toolkit",
    "@near-js/accounts",
    "@near-js/crypto",
    "@near-js/keystores",
    "@near-js/keystores-browser",
    "@near-js/providers",
    "@near-js/signers",
    "@near-js/transactions",
    "@near-js/types",
    "@near-js/utils",
  ],

  // PERFORMANT: Optimized compilation
  reactStrictMode: false,
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
    styledComponents: true,
  },

  // CLEAN: Environment configuration
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // PERFORMANT: Enhanced image optimization
  images: {
    domains: ["localhost"],
    formats: ['image/webp', 'image/avif'],
  },

  // PERFORMANT: Better caching headers
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
    ];
  },

  // PERFORMANT: Additional optimizations
  compress: true,
  poweredByHeader: false,
  output: 'standalone',
};

module.exports = nextConfig;
