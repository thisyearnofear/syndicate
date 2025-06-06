/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize build performance
  experimental: {
    // Enable SWC minification for faster builds
    swcMinify: true,
    // Optimize package imports
    optimizePackageImports: [
      '@coordinationlabs/megapot-ui-kit',
      '@metamask/delegation-toolkit',
      'wagmi',
      'viem',
      'lucide-react',
    ],
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Optimize for development
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    
    // Reduce bundle size
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    // Optimize node_modules
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    };
    
    return config;
  },
  
  // Transpile specific packages that might cause issues
  transpilePackages: [
    '@coordinationlabs/megapot-ui-kit',
    '@metamask/delegation-toolkit',
    '@near-js/accounts',
    '@near-js/crypto',
    '@near-js/keystores',
    '@near-js/keystores-browser',
    '@near-js/providers',
    '@near-js/signers',
    '@near-js/transactions',
    '@near-js/types',
    '@near-js/utils',
  ],
  
  // Reduce hydration warnings
  reactStrictMode: false,
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Image optimization
  images: {
    domains: ['localhost'],
  },
};

module.exports = nextConfig;
