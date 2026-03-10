# Production Readiness Audit

**Date**: March 10, 2026

## Scope
- Repo-only audit. No external infrastructure or chain state was verified.
- Focused on documented production checklists, CI, tests, and configuration consistency.

## Automated Checks Run

| Check | Command | Result | Notes |
| --- | --- | --- | --- |
| Typecheck | `npm run type-check` | FAIL | `.next/types/app/api/solana-balance/route.ts` references missing `route.js`. |
| Lint | `npm run lint` | FAIL | ESLint 9 option errors: `useEslintrc`, `extensions`, `resolvePluginsRelativeTo`, `rulePaths`, `ignorePath`, `reportUnusedDisableDirectives`. |
| Tests | `npm test` | FAIL | Jest haste collision in `lib/forge-std` and missing `@next/swc-darwin-x64`. |

## Findings

### P0. Build Health Gaps
- Typecheck fails on generated `.next/types` entry for `solana-balance` route.
- Lint fails due to incompatible ESLint 9 options.
- Jest runs through vendored `lib/` tests and fails on SWC binary.

### P1. Config Consistency
- `docs/AUTOMATION.md` states cron runs hourly, but `vercel.json` is daily at `0 0 * * *` (UTC). Reconcile before launch.

### P1. Monitoring Not Configured
- No Sentry (or equivalent) integration found in `src/` or config. Monitoring is listed as required in docs but not implemented.

### P1. CI/CD Coverage
- CI exists for Foundry only in `/Users/udingethe/Dev/syndicate/.github/workflows/test.yml`.
- No automated app lint/typecheck/test workflow is defined for the Next.js app.

### P2. Security Checklist Gaps
- Pre-deploy security items remain unverified (audit, multi-sig, incident response, alerts).
- Gitleaks hook is present locally in `.git/hooks/pre-commit`.

## Checklist Status Summary (Repo Evidence)

**Deployment checklist** in `/Users/udingethe/Dev/syndicate/docs/DEPLOYMENT.md`:
- Pre-deployment and post-deployment items require infra or chain verification. Not verifiable in repo.

**Development checklist** in `/Users/udingethe/Dev/syndicate/docs/DEVELOPMENT.md`:
- Testing, monitoring, performance checks, and CI/CD are not complete based on repo evidence.

**Security checklist** in `/Users/udingethe/Dev/syndicate/docs/SECURITY.md`:
- Gitleaks hook is present locally.
- All other items require external verification or implementation.

## Recommendations (Next Actions)

### P0
- Fix `npm run type-check` by removing stale `.next/types` or aligning route output.
- Align ESLint/Next versions or configure lint to use a supported ESLint setup.
- Restrict Jest scope to app tests and ignore `lib/` vendor tests.
- Ensure SWC binary is installed for the host platform.

### P1
- Decide desired cron cadence and update `vercel.json` or docs accordingly.
- Add error monitoring (Sentry or equivalent) and basic alerts.
- Add app CI workflow for lint, typecheck, and tests.

### P2
- Schedule external security audit and multi-sig setup.
- Write and store incident response plan.
- Define on-call and alerting for failed purchases and operator balance.
