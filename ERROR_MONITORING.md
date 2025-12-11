# Error Monitoring Setup

**Last Updated**: December 11, 2025
**Status**: Basic setup guide

## 🎯 Objective

Set up comprehensive error monitoring to catch issues during user testing and production.

## 🔧 Recommended Setup

### Option 1: Sentry (Recommended)

Sentry is a popular error monitoring service that provides:
- Real-time error tracking
- Stack traces and context
- User impact analysis
- Performance monitoring
- Release tracking

#### Installation

```bash
npm install @sentry/nextjs @sentry/tracing
```

#### Configuration

Create a new file `src/lib/sentry.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

export function initSentry() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      environment: process.env.NODE_ENV,
      enabled: process.env.NODE_ENV === 'production',
    });
  }
}
```

#### Integration

Add to `src/app/layout.tsx`:

```typescript
import { initSentry } from '@/lib/sentry';

// Initialize Sentry
initSentry();
```

Add to `src/app/GlobalError.tsx`:

```typescript
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <p>{error.message}</p>
      </body>
    </html>
  );
}
```

#### Environment Variables

Add to `.env`:

```
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
```

### Option 2: Bugsnag

Bugsnag is another excellent error monitoring service.

#### Installation

```bash
npm install @bugsnag/js @bugsnag/plugin-react
```

#### Configuration

```typescript
import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';

Bugsnag.start({
  apiKey: process.env.NEXT_PUBLIC_BUGSNAG_API_KEY,
  plugins: [new BugsnagPluginReact()],
  enabledReleaseStages: ['production', 'staging'],
  releaseStage: process.env.NODE_ENV,
});
```

### Option 3: Basic Console Logging (Temporary)

For immediate testing, you can use enhanced console logging:

```typescript
// src/lib/errorLogger.ts
export function logError(error: Error, context: Record<string, any> = {}) {
  console.error('🚨 ERROR:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    context,
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
  });
  
  // You could also send this to your backend
  if (process.env.NODE_ENV === 'production') {
    fetch('/api/log-error', {
      method: 'POST',
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
        context,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

## 📋 Error Monitoring Checklist

### Basic Setup
- [ ] Choose error monitoring service (Sentry recommended)
- [ ] Install required packages
- [ ] Configure error monitoring
- [ ] Set up environment variables
- [ ] Test error reporting

### Advanced Setup
- [ ] Set up release tracking
- [ ] Configure performance monitoring
- [ ] Add user context tracking
- [ ] Set up error alerts
- [ ] Create dashboards

### Integration Points
- [ ] Global error handler
- [ ] API error logging
- [ ] Wallet connection errors
- [ ] Bridge operation errors
- [ ] Transaction failures
- [ ] Network errors

## 🎯 Key Errors to Monitor

### Critical Errors (High Priority)
1. **Wallet Connection Failures**
   - MetaMask connection rejected
   - Phantom wallet not detected
   - NEAR wallet errors

2. **Bridge Operation Failures**
   - CCTP attestation timeouts
   - Wormhole transfer failures
   - Solana bridge errors
   - Mint failures on Base

3. **Transaction Failures**
   - Insufficient funds
   - Nonce errors
   - Gas estimation failures
   - Transaction timeouts

4. **Network Errors**
   - RPC endpoint failures
   - Chain switching errors
   - Network not supported

### Warning Errors (Medium Priority)
1. **Slow Operations**
   - Bridge operations taking > 5 minutes
   - Wallet balance queries timing out
   - Slow transaction confirmations

2. **UI Issues**
   - Component rendering errors
   - State management issues
   - Prop type warnings

3. **Fallback Scenarios**
   - Protocol fallback triggered
   - Retry attempts
   - Manual intervention required

## 📝 Error Context to Capture

When logging errors, capture as much context as possible:

```typescript
try {
  // Some operation
} catch (error) {
  logError(error, {
    walletType: 'MetaMask',
    network: 'Ethereum',
    transactionHash: '0x...',
    amount: '1.0 USDC',
    protocol: 'CCTP',
    userAddress: '0x...',
    timestamp: Date.now(),
    browser: navigator.userAgent,
    pageUrl: window.location.href,
  });
}
```

## 🚀 Implementation Plan

### Week 1: Basic Monitoring
1. **Set up Sentry account**
2. **Install Sentry SDK**
3. **Configure basic error tracking**
4. **Test error reporting**
5. **Set up alerts for critical errors**

### Week 2: Advanced Monitoring
1. **Add performance monitoring**
2. **Set up release tracking**
3. **Add user context**
4. **Create dashboards**
5. **Document monitoring setup**

### Week 3: Integration Testing
1. **Test all error scenarios**
2. **Verify error context is captured**
3. **Set up error alerts**
4. **Create error response procedures**
5. **Train team on error monitoring**

## 📋 Success Criteria

### Minimum Viable Monitoring
- [ ] All critical errors are captured
- [ ] Error context is comprehensive
- [ ] Alerts are set up for critical issues
- [ ] Team can access error dashboard
- [ ] Errors are categorized properly

### Advanced Monitoring
- [ ] Performance data is captured
- [ ] User impact is tracked
- [ ] Release health is monitored
- [ ] Error trends are analyzed
- [ ] Proactive error prevention

## 🎯 Next Steps

1. **Choose monitoring service** (Sentry recommended)
2. **Set up account and get API keys**
3. **Install SDK and configure**
4. **Test error reporting**
5. **Set up alerts and dashboards**

Once error monitoring is set up, we'll have much better visibility into issues during user testing.