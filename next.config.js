/** @type {import('next').NextConfig} */

const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },

  // Force packages that ship pre-compiled bundles with React hooks to be
  // re-compiled through Next.js's pipeline so they use the app's single
  // React instance.  Without this, webpack resolves their `import React`
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

  // Turbopack resolve alias — mirrors the webpack alias below.
  // Required for `next dev --turbo` to also use a single React instance.
  experimental: {
    turbo: {
      resolveAlias: {
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
    },
  },

  webpack(config, { isServer }) {
    // Webpack resolve alias — the most reliable fix for React Error #321.
    // Forces *every* `require('react')` / `import 'react'` in the bundle
    // to resolve to the single React copy in the project's node_modules,
    // regardless of how the dependent package was compiled or published.
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      };
    }
    return config;
  },
};

module.exports = nextConfig;

