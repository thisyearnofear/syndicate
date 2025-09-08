/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enhanced build performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: [
      "@coordinationlabs/megapot-ui-kit",
      "@metamask/delegation-toolkit",
      "wagmi",
      "viem",
      "lucide-react",
    ],
    // Enable modern bundling
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Development optimizations
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/.next'],
      };
      
      // Faster builds in development
      config.optimization.removeAvailableModules = false;
      config.optimization.removeEmptyChunks = false;
      config.optimization.splitChunks = false;
    }

    // Production optimizations
    if (!dev) {
      // Better chunk splitting
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // Separate vendor chunks
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          // Blockchain-specific chunks
          ethereum: {
            test: /[\\/]node_modules[\\/](ethers|viem|wagmi|@metamask)/,
            name: 'ethereum',
            chunks: 'all',
            priority: 20,
          },
          solana: {
            test: /[\\/]node_modules[\\/](@solana|@bonfida)/,
            name: 'solana',
            chunks: 'all',
            priority: 20,
          },
          near: {
            test: /[\\/]node_modules[\\/](@near-js|near-api-js)/,
            name: 'near',
            chunks: 'all',
            priority: 20,
          },
          // UI components
          ui: {
            test: /[\\/]node_modules[\\/](lucide-react|styled-components)/,
            name: 'ui',
            chunks: 'all',
            priority: 15,
          },
        },
      };
    }

    // Reduce bundle size
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

    // Tree shaking improvements
    config.optimization.usedExports = true;
    config.optimization.sideEffects = false;

    return config;
  },

  // Transpile specific packages
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

  // Performance optimizations
  reactStrictMode: false, // Already disabled for performance
  swcMinify: true, // Use SWC for faster minification
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
    styledComponents: true,
  },

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Image optimization
  images: {
    domains: ["localhost"],
    formats: ['image/webp', 'image/avif'],
  },

  // Headers for better caching
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

  // Redirects for better SEO
  async redirects() {
    return [];
  },

  // Output configuration for better performance
  output: 'standalone',
  
  // Enable gzip compression
  compress: true,
  
  // Power optimizations
  poweredByHeader: false,
  
  // Experimental features for better performance
  experimental: {
    ...nextConfig.experimental,
    optimizeCss: true,
    scrollRestoration: true,
  },
};

module.exports = nextConfig;