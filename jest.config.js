/**
 * Jest Configuration for Syndicate
 * 
 * Configured for Next.js with TypeScript support
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Test environment
  testEnvironment: 'jest-environment-jsdom',
  
  // Module file extensions for importing
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Test match patterns
  testMatch: ['**/tests/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  
  // Ignore external Solidity contract tests (OpenZeppelin/Hardhat) and mocks
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/lib/openzeppelin-contracts/',
    '<rootDir>/tests/mocks/',
  ],

  modulePathIgnorePatterns: [
    '<rootDir>/lib/forge-std/',
    '<rootDir>/lib/openzeppelin-contracts/lib/forge-std/',
  ],
  
  // Transform files with ts-jest
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  
  // Module name mapper for CSS and image imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/mocks/__mocks__/fileMock.js',
    // Mock Solana and other problematic modules in tests
    '^uuid$': '<rootDir>/tests/mocks/__mocks__/uuid.js',
    // Mock wagmi/chains to avoid ESM parsing issues (uses export * from viem/chains)
    '^wagmi/chains$': '<rootDir>/tests/mocks/__mocks__/wagmi-chains.js',
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/types.ts',
    '!src/**/config.ts',
    '!src/**/constants.ts',
    '!src/**/index.ts',
    '!src/**/mock*.ts',
    '!src/**/__mocks__/**',
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],

  // Per-file coverage floors. Each value is the minimum acceptable
  // coverage for that file. Currently calibrated ~5pp below the
  // measured baseline so the gate passes today and fails on a real
  // regression. Bump these up as more tests are added.
  //
  // Glob keys are matched against the absolute file path.
  coverageThreshold: {
    // ── Vault providers (Phase 1.3) ───────────────────────────────────────
    './src/services/vaults/router.ts': {
      lines: 90,
      statements: 90,
      branches: 90,
      functions: 100,
    },
    './src/services/vaults/aaveProvider.ts': {
      lines: 80,
      statements: 80,
      branches: 55,
      functions: 90,
    },
    './src/services/vaults/morphoProvider.ts': {
      lines: 80,
      statements: 80,
      branches: 55,
      functions: 90,
    },
    './src/services/vaults/sparkProvider.ts': {
      lines: 70,
      statements: 70,
      branches: 35,
      functions: 85,
    },
    './src/services/vaults/poolTogetherProvider.ts': {
      lines: 80,
      statements: 80,
      branches: 60,
      functions: 85,
    },
    './src/services/vaults/fhenixProvider.ts': {
      lines: 80,
      statements: 80,
      branches: 70,
      functions: 85,
    },
    // ── Bridge protocols (Phase 1.4) ──────────────────────────────────────
    './src/services/bridges/protocols/debridge.ts': {
      lines: 85,
      statements: 85,
      branches: 65,
      functions: 90,
    },
    './src/services/bridges/protocols/starknet.ts': {
      lines: 90,
      statements: 90,
      branches: 80,
      functions: 90,
    },
    './src/services/bridges/protocols/ton.ts': {
      lines: 55,
      statements: 55,
      branches: 20,
      functions: 55,
    },
    // ── Shared CCTP path (existing test) ──────────────────────────────────
    './src/services/bridges/protocols/cctp.ts': {
      lines: 10,
      statements: 10,
      branches: 5,
      functions: 10,
    },
  },
  
  // Verbose output
  verbose: true,
  
  // Clear mock calls between tests
  clearMocks: true,
  
  // Reset modules between tests
  resetModules: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Transform ESM modules that Jest can't handle
  transformIgnorePatterns: [
    '/node_modules/(?!(uuid|@solana|@coral-xyz|jayson|viem|@viem|@wagmi)/)',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
