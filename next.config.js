/** @type {import('next').NextConfig} */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },

  // Reduce webpack memory usage to avoid OOM on Vercel free tier (1.5GB)
  experimental: {
    clientTraceMetadata: ['*'],
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

  webpack: (config, { isServer, webpack, dev }) => {
    // Memory optimizations for Vercel builds
    if (!dev) {
      // Reduce Terser parallelism to avoid OOM
      config.optimization.minimizer = config.optimization.minimizer.map(minimizer => {
        if (minimizer?.options?.terserOptions?.parallel) {
          minimizer.options.terserOptions.parallel = 2;
        }
        return minimizer;
      });
      // Limit chunk splitting to reduce memory
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          default: false,
          vendors: false,
        },
      };
    }

    // 1) `cofhejs/web` references Node's `fs` for an optional code path that
    //    never runs in the browser. Tell webpack to stub it out so the bundle
    //    is clean and won't crash if that path is ever hit at runtime.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // 2) `pino` (transitive dep of @walletconnect/logger) does a lazy
    //    `require('pino-pretty')` for dev-only pretty-printing. We don't
    //    ship pino-pretty (it's not a runtime requirement), so silence the
    //    "Module not found" warning by telling webpack to ignore the import.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^pino-pretty$/,
      })
    );

    return config;
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Suppresses source map uploading logs during build
  silent: true,

  // Upload source maps in production only
  widenClientFileUpload: true,

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements in production
  // Note: disableLogger is deprecated in favor of removeDebugLogging
  // but we keep it simple for now if the wrapper handles it.
  // Actually let's just remove it as it's deprecated and causing warnings.
});
