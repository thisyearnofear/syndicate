/**
 * STACKS ERROR MAPPER
 *
 * Translates Stacks-specific error patterns into user-facing messages.
 * Pattern is the same as `mapErrorMessage` in `services/vaults/router.ts` —
 * a pure function, easy to unit test, no I/O.
 *
 * The Stacks chainhook / wallet / bridge surface throws a mix of:
 *   - JSON-RPC errors from the Stacks node (rate limits, network errors, contract not found)
 *   - Wallet errors from Leather / Xverse / SIP-018 signers (rejection, locked, disconnected)
 *   - Bridge errors from the Stacks contract on Base (CCTP attestation failures, proxy errors)
 *   - Generic JavaScript errors (timeouts, fetch failures)
 *
 * Without this mapping the user sees the raw error string ("TypeError: fetch failed"
 * or `"User rejected the transaction"` from the wallet), which is either
 * unhelpful or alarming. This file gives every error a deterministic,
 * user-friendly message.
 *
 * New patterns should be added here as the codebase surfaces them, not
 * inline in catch blocks scattered across the Stacks files.
 *
 * **Order matters.** More specific patterns are checked first. The
 * 'bridge/chainhook/CCTP' check must come before the generic
 * 'network/timeout' check (so "Chainhook delivery failed: timeout"
 * is recognised as a bridge issue, not a network blip). The
 * user-cancellation check is first so it wins over everything.
 */

/**
 * Detect user-cancellation patterns in errors from any layer.
 *
 * The pattern is intentionally specific: "user rejected", "user cancelled",
 * "user denied", "user abort*". A bare "rejected" anywhere in the message
 * is NOT enough — the SIP-018 wallet, for example, says
 * "SIP-018 signature rejected by signer" when the signature itself is
 * malformed, which is a different kind of failure from the user
 * explicitly saying no. Both should be reachable.
 */
function isUserCancellation(error: unknown): boolean {
    if (!error) return false;
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();
    return /\buser\s+(rejected|cancelled|canceled|denied|aborted)\b/.test(lower);
}

/**
 * Map a Stacks-related error to a user-facing message.
 *
 * - `error` — the raw error thrown by the wallet, chainhook, bridge, or RPC layer.
 * - `defaultMessage` — fallback when the error doesn't match any known pattern.
 *
 * Returns a string suitable for direct display in the UI.
 */
export function mapStacksError(error: unknown, defaultMessage: string): string {
    // User cancellation: highest priority. We don't want a network error
    // message to mask the fact that the user explicitly said no.
    if (isUserCancellation(error)) {
        return 'Transaction cancelled';
    }

    // From here on, extract the message string we can pattern-match.
    // Treat null/undefined as "no message" and use the default.
    let raw: string;
    if (error === null || error === undefined) {
        raw = '';
    } else if (error instanceof Error) {
        raw = error.message;
    } else {
        raw = String(error);
    }
    const lower = raw.toLowerCase();

    // --- Bridge / chainhook / CCTP errors (check FIRST so a "chainhook timeout"
    //     isn't misclassified as a network error) ---

    if (lower.includes('chainhook') || lower.includes('attestation') || lower.includes('cctp')) {
        return 'Bridge service temporarily unavailable. Your funds are safe; please try again in a few minutes.';
    }
    if (lower.includes('bridge') && lower.includes('fail')) {
        return 'Bridge transaction failed. Your Stacks transaction was not confirmed; please retry.';
    }

    // --- Wallet errors (Leather / Xverse / Asigna / Fordefi) ---

    if (lower.includes('wallet') && (lower.includes('locked') || lower.includes('disconnected') || lower.includes('not connected'))) {
        return 'Stacks wallet is locked or disconnected. Please unlock it and try again.';
    }
    if (lower.includes('no stacks wallet')) {
        return 'No Stacks wallet detected. Install Leather, Xverse, or another Stacks-compatible wallet.';
    }

    // --- Balance / amount errors (covers "insufficient" and "not enough") ---

    if ((lower.includes('insufficient') || lower.includes('not enough')) &&
        (lower.includes('usdcx') || lower.includes('balance') || lower.includes('funds'))) {
        return 'Insufficient USDCx balance. Add more USDCx to your Stacks wallet and try again.';
    }
    if ((lower.includes('insufficient') || lower.includes('not enough')) && lower.includes('stx')) {
        return 'Insufficient STX for transaction fees. Top up your STX balance and try again.';
    }
    if ((lower.includes('insufficient') || lower.includes('not enough')) &&
        (lower.includes('btc') || lower.includes('sbtc'))) {
        return 'Insufficient BTC for sBTC bridging. Top up your BTC balance and try again.';
    }

    // --- SIP-018 / signing errors ---

    if (lower.includes('sip-018') || lower.includes('authorization') || lower.includes('signature')) {
        return 'Stacks signature failed. Please retry the signing request in your wallet.';
    }

    // --- Network / RPC errors ---

    if (lower.includes('rate limit') || lower.includes('too many requests')) {
        return 'Stacks RPC rate limit reached. Please wait a moment and try again.';
    }
    if (lower.includes('network') || lower.includes('econnrefused') || lower.includes('fetch failed')) {
        return 'Stacks network error. Check your connection and try again.';
    }
    if (lower.includes('contract') && (lower.includes('not found') || lower.includes('does not exist'))) {
        return 'Stacks contract not deployed. The bridge contract may be temporarily unavailable.';
    }

    // --- Fallback ---
    return raw || defaultMessage;
}
