/** @type {import('next').NextConfig} */

const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },

  // Reduce build memory usage by splitting webpack compilation into workers
  // This helps prevent OOM errors on memory-constrained build environments (Vercel Hobby)
  experimental: {
    webpackBuildWorker: true,
  },

  // Force packages that ship pre-compiled bundles with React hooks to be
  // re-compiled through Next.js's pipeline so they use the app's single
  // React instance.
  // Note: @near-wallet-selector/* wallet packages beyond core/modal-ui are
  // dynamically imported, so they don't need to be in transpilePackages.
  // @solana/wallet-adapter-react-ui and -base are also dynamically imported.
  transpilePackages: [
    '@near-wallet-selector/modal-ui',
    '@near-wallet-selector/core',
    '@solana/wallet-adapter-react',
    '@tonconnect/ui-react',
    '@rainbow-me/rainbowkit',
  ],
};

module.exports = withSentryConfig(nextConfig, {
  // Suppresses source map uploading logs during build
  silent: true,

  // Upload source maps in production only
  widenClientFileUpload: true,

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements in production
  disableLogger: true,
});
