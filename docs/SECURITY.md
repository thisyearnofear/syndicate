# Security Guide

**Last Updated**: March 22, 2026

**Audit**: March 10, 2026. See `docs/PRODUCTION_READINESS_AUDIT.md`.

---

## Secret Detection

This project uses [gitleaks](https://github.com/gitleaks/gitleaks) to prevent committing secrets.

### How It Works

Pre-commit hook automatically scans staged files. If secrets are detected, commit is blocked.

### Installation

Hook is at `.git/hooks/pre-commit`. Manual installation:

```bash
brew install gitleaks
```

### Handling False Positives

Add fingerprint to `.gitleaksignore`:
```bash
# Example
test-file.txt:generic-api-key:1
```

### Testing

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
| Megapot V2 | `0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2` | Base Mainnet |
| Stacks Lottery V3 | `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3` | Stacks Mainnet |

### Security Properties

**Proxy Contract**:
- Immutable (no upgradability)
- No admin keys in hot path
- Replay-protected bridge IDs
- Fail-safe (USDC → recipient if purchase fails)
- Reentrancy guarded

### Recommended Audits

- [ ] Professional security audit before mainnet
- [ ] Bug bounty program
- [ ] Multi-sig for contract owner

---

## Infrastructure Security

### Vercel

**Configuration**:
- Enable Vercel Secrets for environment variables
- Use Preview deployments for testing
- Enable deployment protection rules

### Database (Vercel Postgres)

**Security**:
- Connection strings in secrets
- Row-level security where applicable
- Regular backups enabled
- Access logging

### RPC Endpoints

**Configuration**:
- Use dedicated API keys per environment
- Enable rate limiting
- Monitor usage patterns

---

## Application Security

### Environment Variables

**Required Secrets**:
```bash
PRIVATE_KEY=0x...              # Deployer key (deployment only)
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

## KYC/AML Compliance (Civic Pass)

### Compliance Model

- **KYC gates vault deposits**: Users must verify identity before accessing Drift JLP vault
- **Prize claims permissionless**: Lottery payouts don't require KYC
- **On-chain attestation**: Civic GatewayCredential stored on-chain
- **Three verification tiers**: CAPTCHA (demo), Liveness (beta), ID_VERIFICATION (production)

### Civic Integration Security

- Civic App ID stored in environment variables
- GatewayProvider wraps permissioned components
- Verification status checked before allowing deposits
- No sensitive user data stored by application (Civic handles KYC data)

### Configuration

```typescript
// src/components/civic/CivicGateProvider.tsx
const ACTIVE_NETWORK = CIVIC_NETWORKS.CAPTCHA; // Demo (hackathon)
// const ACTIVE_NETWORK = CIVIC_NETWORKS.ID_VERIFICATION; // Production
```

### Best Practices

- Use CAPTCHA network for development/testing only
- Switch to ID_VERIFICATION for production compliance
- Display compliance badges (KYC, AML, Sanctions) clearly
- Provide privacy notice explaining data usage
- Never store or transmit Civic verification data off-chain

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
- [x] Gitleaks pre-commit hook installed
- [ ] Contract audit completed
- [ ] Multi-sig configured for owner
- [ ] Monitoring/alerting setup

### Post-Deployment

- [ ] Regular security reviews (quarterly)
- [ ] Dependency audits (`pnpm audit`)
- [ ] Penetration testing
- [ ] Bug bounty program active

---

## References

- **Overview**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
