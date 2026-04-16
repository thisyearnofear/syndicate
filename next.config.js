/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },

  // Force packages with bundled React to re-compile through Next.js pipeline
  // so they use the app's single React instance.
  // Combined with .npmrc shamefully-hoist=true this eliminates the duplicate
  // React instance that causes React Error #321 (Invalid hook call).
  transpilePackages: [
    '@civic/solana-gateway-react',
    '@civic/gateway-client-react',
    '@civic/gateway-client-core',
    '@civic/solana-gateway-chain-client',
  ],
};

module.exports = nextConfig;

