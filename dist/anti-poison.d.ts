import type { AntiPoisonConfig } from './types.js';
/**
 * Check if `target` is a vanity match for any address in `knownAddresses`.
 * Match rule: first 4 hex chars + last 4 hex chars are identical, but middle differs.
 * This is the primary pattern for address poisoning attacks.
 */
export declare function detectVanityMatch(target: string, knownAddresses: string[]): string | null;
/**
 * Run anti-poisoning checks on a target address.
 * Throws MaiatPoisonError if poisoning is detected.
 */
export declare function antiPoisonGate(targetAddress: string, walletAddress: string | undefined, config: AntiPoisonConfig): Promise<void>;
//# sourceMappingURL=anti-poison.d.ts.map