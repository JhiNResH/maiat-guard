export interface MaiatCheckResult {
    address: string;
    score: number;
    riskLevel: 'Low' | 'Medium' | 'High' | 'Unknown';
    verdict: 'allow' | 'review' | 'block';
    source: 'api' | 'cache' | 'fallback';
}
export declare class MaiatTrustError extends Error {
    readonly address: string;
    readonly score: number;
    readonly riskLevel: string;
    readonly verdict: string;
    constructor(result: MaiatCheckResult);
}
//# sourceMappingURL=errors.d.ts.map