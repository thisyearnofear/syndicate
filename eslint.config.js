/**
 * ESLint Flat Config (ESLint 9+)
 *
 * eslint-config-next v16 provides native flat config exports
 * so no FlatCompat bridge is needed.
 *
 * next lint was removed in Next.js 16 — use eslint CLI directly.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextCoreWebVitals = require('eslint-config-next/core-web-vitals');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextTypescript = require('eslint-config-next/typescript');

const eslintConfig = [
  // Global ignores
  {
    ignores: [
      'lib/openzeppelin-contracts/**',
      'contracts/**',
      'dev-tools/**',
      'empty-module/**',
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
    ],
  },

  // Next.js core-web-vitals and TypeScript configs
  ...nextCoreWebVitals,
  ...nextTypescript,

  // Custom rules
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];

module.exports = eslintConfig;
