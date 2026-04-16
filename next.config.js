/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },

  // Fix React Error #321 (Invalid hook call) caused by @civic/solana-gateway-react
  // shipping pre-compiled CJS/ESM bundles that embed their own React instance.
  // transpilePackages forces Next.js to re-compile these packages through its
  // own webpack/turbopack pipeline so they use the app's single React instance.
  transpilePackages: [
    '@civic/solana-gateway-react',
    '@civic/gateway-client-react',
  ],
};

module.exports = nextConfig;
