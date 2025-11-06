/** @type {import('next').NextConfig} */
const nextConfig = {
  // Development-specific optimizations
  reactStrictMode: false, // Disable for faster development
  swcMinify: false, // Disable SWC minification for faster builds
  compress: false, // Disable compression for faster development
  
  // Fast refresh optimizations
  experimental: {
    forceSwcTransforms: false,
    legacyBrowsers: false,
    browsersListForSwc: false,
  },

  // Disable expensive features in development
  typescript: {
    // Ignore build errors in development
    ignoreBuildErrors: false,
  },
  
  eslint: {
    // Warning: This allows production builds to complete even with ESLint errors
    ignoreDuringBuilds: true,
  },
  
  // Faster development server
  devServer: {
    // Enable fast refresh
    hot: true,
  },
};

module.exports = nextConfig;