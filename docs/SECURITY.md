# Security Guide

**Last Updated**: March 20, 2026

**Audit**: March 10, 2026. See `docs/PRODUCTION_READINESS_AUDIT.md`.

---

## Secret Detection

This project uses [gitleaks](https://github.com/gitleaks/gitleaks) to prevent committing secrets.

### How It Works

A pre-commit hook automatically scans staged files for secrets before each commit. If secrets are detected, the commit is blocked.

### Installation

The hook is already installed at `.git/hooks/pre-commit`. If gitleaks is not installed, the hook will attempt to install it via Homebrew on first run.

Manual installation:
```bash
brew install gitleaks
```

### Handling False Positives

If gitleaks flags something that isn't actually a secret:

1. Note the fingerprint from the error message (format: `file:rule:line`)
2. Add it to `.gitleaksignore`:
```bash
# Example
test-file.txt:generic-api-key:1
```

### Bypassing the Hook (Not Recommended)

In rare cases where you need to bypass:
```bash
git commit --no-verify
```

⚠️ **Only use this if you're absolutely certain there are no secrets in your commit.**

### Testing

Test the hook:
```bash
echo "secret: sk_test_123456789" > test.txt
git add test.txt
git commit -m "test"  # Should be blocked
```

---

## Key Management

### Webhook Secrets

**Configuration**:
- `GELATO_WEBHOOK_SECRET` - Gelato webhook verification
- `AUTOMATION_API_KEY` - Cron job authentication
- `CHAINHOOK_SECRET_TOKEN` - Chainhook webhook authorization

**Best Practices**:
- Generate strong random secrets (32+ bytes)
- Store in environment variables only
- Rotate if compromised

### Deployer Keys

**Production**:
- Use hardware wallet (Ledger, Trezor)
- Multi-sig for contract ownership

**Testing**:
- Use testnet accounts only
- Never reuse production keys

---

## Contract Security

### Deployed Contracts

| Contract | Address | Network |
|----------|---------|---------|
| MegapotAutoPurchaseProxy | `0x707043a8c35254876B8ed48F6537703F7736905c` | Base Mainnet |
| Megapot | `0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95` | Base Mainnet |
| Stacks Lottery V3 | `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3` | Stacks Mainnet |

### Security Properties

**Proxy Contract**:
- Immutable (no upgradability)
- No admin keys in hot path
- Replay-protected bridge IDs
- Fail-safe (USDC → recipient if purchase fails)
- Reentrancy guarded

**Stacks Contract**:
- Owner controls emergency pause
- Fee limits prevent exploitation
- Purchase ID tracking prevents replay
- Proper event emission for auditing

### Recommended Audits

- [ ] Professional security audit before mainnet
- [ ] Bug bounty program
- [ ] Multi-sig for contract owner
- [ ] Regular security reviews

---

## Infrastructure Security

### Vercel

**Configuration**:
- Enable Vercel Secrets for environment variables
- Use Preview deployments for testing
- Enable deployment protection rules

**Monitoring**:
- Function logs for errors
- Cron execution monitoring
- Alert on failed invocations

### Database (Vercel Postgres)

**Security**:
- Connection strings in secrets
- Row-level security where applicable
- Regular backups enabled
- Access logging

**Monitoring**:
- Query performance
- Connection pool usage
- Error rates

### RPC Endpoints

**Configuration**:
- Use dedicated API keys per environment
- Enable rate limiting
- Monitor usage patterns

**Providers**:
- Alchemy (Base, Ethereum)
- Hiro (Stacks)
- Public RPC (Solana, NEAR)

---

## Application Security

### Environment Variables

**Required Secrets**:
```bash
# Never commit these
PRIVATE_KEY=0x...              # Deployer key (contract deployment only)
GELATO_WEBHOOK_SECRET=...       # Webhook verification
POSTGRES_URL=...                # Database connection
```

**Storage**:
- `.env.local` for development (gitignored)
- Vercel Secrets for production
- AWS Secrets Manager for sensitive keys

### Input Validation

**User Inputs**:
- Validate all addresses (checksum)
- Sanitize transaction hashes
- Rate limit API endpoints

**Smart Contract Calls**:
- Validate recipient addresses
- Check amounts before approval
- Use reentrancy guards

### Authentication

**Wallet Connections**:
- Verify wallet signatures
- Session timeout (24 hours)
- Clear session on disconnect

**API Endpoints**:
- HMAC signature verification (webhooks)
- API key authentication (cron jobs)
- Rate limiting per IP

---

## Monitoring & Alerting

### Security Alerts

Set up alerts for:
- ⚠️ Operator balance < 100 USDC
- ⚠️ Failed proxy calls > 5 in 1 hour
- ⚠️ Unusual transaction patterns
- ⚠️ Webhook signature failures
- ⚠️ Database connection errors

### Logging

**Application Logs**:
- Wallet connection events
- Purchase transactions
- Bridge operations
- Error stack traces

**Contract Events**:
- `BridgePurchaseInitiated`
- `PurchaseProcessed`
- `WinningsRecorded`

### Incident Response

**If Secret Compromised**:
1. Rotate key immediately
2. Audit recent transactions
3. Update all environments
4. Document incident

**If Contract Exploited**:
1. Pause contract if possible
2. Document exploit vector
3. Notify affected users
4. Deploy fix

---

## Compliance

### Data Privacy

**User Data**:
- Wallet addresses (public by nature)
- Transaction history (on-chain)
- No PII stored

**GDPR Considerations**:
- Right to deletion (off-chain data only)
- Data portability (export on request)
- Privacy policy required

### KYC/AML (Civic Pass)

**Compliance Model**:
- **KYC gates vault deposits**: Users must verify identity before accessing Drift JLP vault
- **Prize claims permissionless**: Lottery payouts don't require KYC
- **On-chain attestation**: Civic GatewayCredential stored on-chain
- **Three verification tiers**: CAPTCHA (demo), Liveness (beta), ID_VERIFICATION (production)

**Civic Integration Security**:
- Civic App ID stored in environment variables
- GatewayProvider wraps permissioned components
- Verification status checked before allowing deposits
- No sensitive user data stored by application (Civic handles KYC data)

**Configuration**:
```typescript
// src/components/civic/CivicGateProvider.tsx
const ACTIVE_NETWORK = CIVIC_NETWORKS.CAPTCHA; // Demo (hackathon)
// const ACTIVE_NETWORK = CIVIC_NETWORKS.ID_VERIFICATION; // Production
```

**Best Practices**:
- Use CAPTCHA network for development/testing only
- Switch to ID_VERIFICATION for production compliance
- Display compliance badges (KYC, AML, Sanctions) clearly
- Provide privacy notice explaining data usage
- Never store or transmit Civic verification data off-chain

### Terms of Service

**Recommended**:
- Clear usage terms
- Risk disclosures
- Limitation of liability
- Jurisdiction clauses

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets in secrets manager
- [x] Gitleaks pre-commit hook installed (local hook present)
- [ ] Contract audit completed
- [ ] Multi-sig configured for owner
- [ ] Monitoring/alerting setup
- [ ] Incident response plan documented

### Post-Deployment

- [ ] Regular security reviews (quarterly)
- [ ] Dependency audits (`npm audit`)
- [ ] Penetration testing
- [ ] Bug bounty program active
- [ ] Security documentation updated

---

## References

- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Development**: [DEVELOPMENT.md](./DEVELOPMENT.md)
