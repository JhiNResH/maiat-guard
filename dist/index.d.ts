import type { WalletClient } from 'viem';
import type { MaiatTrustOptions } from './types.js';
export { MaiatTrustError, MaiatPoisonError } from './types.js';
export type { MaiatCheckResult, MaiatTrustOptions, SignedScore, AntiPoisonConfig, ThreatReport } from './types.js';
export { checkTrust } from './trust-check.js';
export { fetchSignedScore, encodeSwapHookData } from './hook-data.js';
export { detectVanityMatch } from './anti-poison.js';
export { reportThreat } from './report-threat.js';
export { createMaiatAgentWallet } from './agent-wallet.js';
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
export declare function withMaiatTrust<T extends WalletClient>(client: T, opts?: MaiatTrustOptions): T;
//# sourceMappingURL=index.d.ts.map