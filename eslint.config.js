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
      'lib/v4-core/**',
      '.agents/**',
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

  // Register containment (docs/DESIGN.md): the lab/arena visual language
  // must not leak into consumer money surfaces. New UI in these files gets
  // the tokens; everyone else uses ACCENTS from src/config/design.ts.
  {
    files: ['src/**/*.tsx'],
    ignores: [
      'src/components/layout/**',
      'src/components/motion/**',
      'src/components/NavigationHeader.tsx',
      'src/components/home/CampaignBanner.tsx',
      'src/components/season/**',
      'src/components/xlayer/**',
      'src/app/season/**',
      'src/app/xlayer/**',
      'src/app/operators/**',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Literal[value=/arena-|surface-arena|lab-scanline|\\bhud\\b|seal-crack|seal-fleck|cutoff-ring|grow-bloom|clip-reveal/], TemplateElement[value.raw=/arena-|surface-arena|lab-scanline|\\bhud\\b|seal-crack|seal-fleck|cutoff-ring|grow-bloom|clip-reveal/]",
          message:
            'Lab/arena register tokens are route-scoped (docs/DESIGN.md). Use ACCENTS from src/config/design.ts on consumer surfaces.',
        },
      ],
    },
  },
];

module.exports = eslintConfig;
