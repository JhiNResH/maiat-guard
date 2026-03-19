/**
 * Token Guard — auto-checks token safety before swap transactions.
 *
 * Detects swap calldata (Uniswap V2/V3/V4, Universal Router), extracts
 * the output token address, and checks it against Maiat's token safety API.
 */
export interface TokenCheckResult {
    address: string;
    verdict: 'safe' | 'caution' | 'danger' | 'unknown';
    score: number;
    riskFlags: string[];
    riskSummary: string;
    isHoneypot: boolean;
    source: 'api' | 'cache';
}
export declare class MaiatTokenError extends Error {
    readonly tokenAddress: string;
    readonly score: number;
    readonly verdict: string;
    readonly riskFlags: string[];
    constructor(result: TokenCheckResult);
}
/**
 * Check if a transaction target is a known DEX router.
 */
export declare function isSwapTransaction(to: string | undefined): boolean;
/**
 * Add a custom router address to detection list.
 */
export declare function addRouter(address: string): void;
/**
 * Extract output token address from swap calldata.
 * Returns null if calldata can't be parsed.
 */
export declare function extractTokenOut(data: string | undefined): string | null;
/**
 * Check token safety via Maiat Protocol API.
 */
export declare function checkToken(tokenAddress: string, apiKey?: string): Promise<TokenCheckResult | null>;
//# sourceMappingURL=token-guard.d.ts.map