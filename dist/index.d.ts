import type { WalletClient } from 'viem';
import { type MaiatCheckResult } from './errors.js';
export { MaiatTrustError } from './errors.js';
export type { MaiatCheckResult } from './errors.js';
export interface MaiatTrustOptions {
    /**
     * Block transactions to addresses with trust score below this threshold.
     * @default 60
     */
    minScore?: number;
    /**
     * Maiat API key for paid tier (no rate limit).
     * Without key: free tier, 10 req/min per IP.
     */
    apiKey?: string;
    /**
     * How to handle low-trust addresses.
     * - 'block'  → throws MaiatTrustError (default)
     * - 'warn'   → calls onWarn(), tx continues
     * - 'silent' → no check, passthrough
     */
    mode?: 'block' | 'warn' | 'silent';
    /**
     * Called when mode='warn' and address is low-trust.
     */
    onWarn?: (result: MaiatCheckResult) => void;
}
/**
 * Wraps a viem WalletClient to auto-check Maiat trust score
 * before every sendTransaction / writeContract call.
 *
 * @example
 * const client = withMaiatTrust(walletClient, { minScore: 60 })
 * await client.sendTransaction({ to: '0x...', value: parseEther('1') })
 */
export declare function withMaiatTrust<T extends WalletClient>(client: T, opts?: MaiatTrustOptions): T;
//# sourceMappingURL=index.d.ts.map