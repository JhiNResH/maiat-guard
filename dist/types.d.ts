export interface MaiatCheckResult {
    address: string;
    score: number;
    riskLevel: 'Low' | 'Medium' | 'High' | 'Unknown';
    verdict: 'allow' | 'review' | 'block';
    source: 'api' | 'cache' | 'fallback';
    breakdown?: {
        completionRate?: number;
        paymentRate?: number;
        expireRate?: number;
        totalJobs?: number;
        ageWeeks?: number;
    };
}
export declare class MaiatTrustError extends Error {
    readonly address: string;
    readonly score: number;
    readonly riskLevel: string;
    readonly verdict: string;
    constructor(result: MaiatCheckResult);
}
export declare class MaiatPoisonError extends Error {
    readonly address: string;
    readonly matchedAddress?: string;
    readonly threatType: 'vanity_match' | 'dust_liveness';
    constructor(address: string, threatType: 'vanity_match' | 'dust_liveness', matchedAddress?: string);
}
export interface SignedScore {
    token: string;
    score: number;
    timestamp: number;
    nonce: number;
    signature: string;
    hookDataHex?: string;
}
export interface AntiPoisonConfig {
    /** Enable vanity match detection (first4+last4 collision) */
    vanityMatch?: boolean;
    /** Enable liveness check for new addresses */
    livenessCheck?: boolean;
    /** Etherscan-compatible API key for tx history */
    etherscanApiKey?: string;
    /** Block explorer API URL (e.g. https://api.basescan.org/api) */
    explorerUrl?: string;
}
export interface ThreatReport {
    maliciousAddress: string;
    threatType: 'address_poisoning' | 'low_trust' | 'vanity_match' | 'dust_liveness';
    evidence: Record<string, unknown>;
    guardVersion: string;
    chainId?: number;
    timestamp: number;
}
export interface MaiatTrustOptions {
    /**
     * Block transactions to addresses with trust score below this threshold.
     * @default 60
     */
    minScore?: number;
    /**
     * Maiat API key for paid tier (no rate limit).
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
    /**
     * Record transaction outcomes back to Maiat.
     * @default false
     */
    recordOutcomes?: boolean;
    /**
     * Known Uniswap V4 router addresses — Guard will auto-fetch signed scores for swaps.
     */
    routerAddresses?: string[];
    /**
     * User address for fee discount in TrustGateHook (defaults to wallet account).
     */
    feeTarget?: string;
    /**
     * Anti-poisoning configuration. Set `true` for defaults or pass config object.
     * @default false
     */
    antiPoison?: boolean | AntiPoisonConfig;
    /**
     * Auto-report threats to Maiat when blocking. Privacy-safe (no sender context).
     * @default true
     */
    reportThreats?: boolean;
    /**
     * Enable token safety checks on swap transactions.
     * Detects Uniswap V2/V3/V4 swaps and checks output token safety.
     * @default true
     */
    tokenGuard?: boolean;
    /**
     * Minimum token safety score to allow a swap (0-100).
     * @default 40
     */
    minTokenScore?: number;
    /**
     * Called when mode='warn' and a swap target token is dangerous.
     */
    onTokenWarn?: (result: import('./token-guard.js').TokenCheckResult) => void;
}
//# sourceMappingURL=types.d.ts.map