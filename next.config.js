/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },

  // Force packages that ship pre-compiled bundles with React hooks to be
  // re-compiled through Next.js's pipeline so they use the app's single
  // React instance.  Without this, the bundler resolves their `import React`
  // to a different copy → React Error #321 (Invalid hook call).
  transpilePackages: [
    '@near-wallet-selector/modal-ui',
    '@near-wallet-selector/core',
    '@near-wallet-selector/here-wallet',
    '@near-wallet-selector/meteor-wallet',
    '@near-wallet-selector/my-near-wallet',
    '@near-wallet-selector/nightly',
    '@near-wallet-selector/sender',
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-base',
    '@tonconnect/ui-react',
    '@rainbow-me/rainbowkit',
    '@coordinationlabs/megapot-ui-kit',
    'starknetkit',
  ],

  // Next.js 16 uses Turbopack by default for production builds.
  // resolveAlias forces all `import 'react'` to the single copy in
  // node_modules, eliminating duplicate React instances.
  // NOTE: Turbopack expects relative path strings, NOT path.resolve().
  turbopack: {
    resolveAlias: {
      react: './node_modules/react',
      'react-dom': './node_modules/react-dom',
      'react/jsx-runtime': './node_modules/react/jsx-runtime',
      'react/jsx-dev-runtime': './node_modules/react/jsx-dev-runtime',
    },
  },

  // Fallback for `next dev` without --turbo (uses webpack).
  webpack(config, { isServer }) {
    if (!isServer) {
      const path = require('path');
      config.resolve.alias = {
        ...config.resolve.alias,
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
        'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
      };
    }
    return config;
  },
};

module.exports = nextConfig;
