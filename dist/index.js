import { checkTrust } from './trust-check.js';
import { antiPoisonGate } from './anti-poison.js';
import { reportThreat } from './report-threat.js';
import { isSwapTransaction, extractTokenOut, checkToken, MaiatTokenError } from './token-guard.js';
import { MaiatTrustError, MaiatPoisonError } from './types.js';
// Re-exports
export { MaiatTrustError, MaiatPoisonError } from './types.js';
export { checkTrust } from './trust-check.js';
export { checkToken, isSwapTransaction, extractTokenOut, MaiatTokenError, addRouter } from './token-guard.js';
export { fetchSignedScore, encodeSwapHookData } from './hook-data.js';
export { detectVanityMatch } from './anti-poison.js';
export { reportThreat } from './report-threat.js';
export { createMaiatAgentWallet } from './agent-wallet.js';
export { withMaiatAcp, MaiatAcpError } from './acp-wrap.js';
const MAIAT_API = 'https://app.maiat.io';
/**
 * Fire-and-forget outcome recording after a transaction.
 */
function recordOutcome(agentAddress, outcome, apiKey, txHash) {
    fetch(`${MAIAT_API}/api/v1/outcome`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Maiat-Key': apiKey,
        },
        body: JSON.stringify({
            jobId: txHash ?? `guard-${Date.now()}`,
            agentAddress,
            outcome,
            source: 'maiat-guard',
        }),
    }).catch(() => { });
}
/**
 * Wraps a viem WalletClient to auto-check Maiat trust score
 * before every sendTransaction / writeContract call.
 *
 * v0.2.0 adds: anti-poisoning, threat reporting, TrustGateHook hookData support.
 *
 * @example
 * ```ts
 * const client = withMaiatTrust(walletClient, {
 *   minScore: 60,
 *   antiPoison: true,
 *   reportThreats: true,
 * })
 * await client.sendTransaction({ to: '0x...', value: parseEther('1') })
 * ```
 */
export function withMaiatTrust(client, opts = {}) {
    const { minScore = 60, apiKey, mode = 'block', onWarn, recordOutcomes: enableOutcomes = false, antiPoison = false, reportThreats = true, tokenGuard = true, minTokenScore = 40, onTokenWarn, } = opts;
    if (mode === 'silent')
        return client;
    // Resolve anti-poison config
    const poisonConfig = antiPoison
        ? (typeof antiPoison === 'object' ? antiPoison : { vanityMatch: true, livenessCheck: true })
        : null;
    async function gate(address) {
        if (!address)
            return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const walletAddress = client.account?.address;
        // 1. Anti-poisoning checks (before trust check — cheaper to fail fast)
        if (poisonConfig) {
            try {
                await antiPoisonGate(address, walletAddress, poisonConfig);
            }
            catch (err) {
                if (err instanceof MaiatPoisonError) {
                    // Report threat
                    if (reportThreats) {
                        reportThreat(address, err.threatType === 'vanity_match' ? 'vanity_match' : 'dust_liveness', {
                            matchedAddress: err.matchedAddress,
                            threatType: err.threatType,
                        }, apiKey);
                    }
                    if (mode === 'block')
                        throw err;
                    if (mode === 'warn') {
                        onWarn?.({
                            address,
                            score: 0,
                            riskLevel: 'High',
                            verdict: 'block',
                            source: 'fallback',
                        });
                        return;
                    }
                }
                // Other errors → fail-open
            }
        }
        // 2. Trust score check
        const result = await checkTrust(address, apiKey);
        // null = unknown address or API error → fail-open
        if (!result)
            return;
        const isLowTrust = result.verdict === 'block' || result.score < minScore;
        if (!isLowTrust)
            return;
        // Report low-trust threat
        if (reportThreats) {
            reportThreat(address, 'low_trust', { score: result.score, riskLevel: result.riskLevel, verdict: result.verdict }, apiKey);
        }
        if (mode === 'block') {
            throw new MaiatTrustError(result);
        }
        if (mode === 'warn') {
            onWarn?.(result);
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return client.extend((c) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async sendTransaction(args) {
            const to = args.to;
            await gate(to);
            // Token guard: if this is a swap, check output token safety
            if (tokenGuard && to && isSwapTransaction(to)) {
                const data = args.data;
                const tokenOut = extractTokenOut(data);
                if (tokenOut) {
                    const tokenResult = await checkToken(tokenOut, apiKey);
                    if (tokenResult) {
                        const isDangerous = tokenResult.verdict === 'danger' ||
                            tokenResult.isHoneypot ||
                            tokenResult.score < minTokenScore;
                        if (isDangerous) {
                            if (reportThreats) {
                                reportThreat(tokenOut, 'low_trust', {
                                    tokenScore: tokenResult.score,
                                    riskFlags: tokenResult.riskFlags,
                                    isHoneypot: tokenResult.isHoneypot,
                                    type: 'token_swap_blocked',
                                }, apiKey);
                            }
                            if (mode === 'block') {
                                throw new MaiatTokenError(tokenResult);
                            }
                            if (mode === 'warn') {
                                onTokenWarn?.(tokenResult);
                            }
                        }
                    }
                }
            }
            try {
                const txHash = await c.sendTransaction(args);
                if (enableOutcomes && apiKey && to) {
                    recordOutcome(to, 'success', apiKey, txHash);
                }
                return txHash;
            }
            catch (err) {
                if (enableOutcomes && apiKey && to) {
                    recordOutcome(to, 'failure', apiKey);
                }
                throw err;
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async writeContract(args) {
            await gate(args.address);
            return c.writeContract(args);
        },
    }));
}
//# sourceMappingURL=index.js.map