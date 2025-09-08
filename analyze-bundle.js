// PERFORMANT: Bundle analysis configuration following Core Principles
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

// CLEAN: Bundle analysis configuration
const bundleAnalyzer = {
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
  analyzerMode: 'static',
  reportFilename: './bundle-analysis.html',
  defaultSizes: 'gzip',
  generateStatsFile: true,
  statsFilename: './bundle-stats.json',
  logLevel: 'info',
};

// MODULAR: Webpack plugin configuration
function createBundleAnalyzerPlugin() {
  if (!bundleAnalyzer.enabled) return [];
  
  return [
    new BundleAnalyzerPlugin({
      analyzerMode: bundleAnalyzer.analyzerMode,
      reportFilename: bundleAnalyzer.reportFilename,
      openAnalyzer: bundleAnalyzer.openAnalyzer,
      defaultSizes: bundleAnalyzer.defaultSizes,
      generateStatsFile: bundleAnalyzer.generateStatsFile,
      statsFilename: bundleAnalyzer.statsFilename,
      logLevel: bundleAnalyzer.logLevel,
    }),
  ];
}

// DRY: Export configuration
module.exports = {
  bundleAnalyzer,
  createBundleAnalyzerPlugin,
};