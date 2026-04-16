/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },

  // Force packages that ship pre-compiled bundles with React hooks to be
  // re-compiled through Next.js's pipeline so they use the app's single
  // React instance.
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
};

module.exports = nextConfig;
