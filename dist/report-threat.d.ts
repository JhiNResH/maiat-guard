import type { ThreatReport } from './types.js';
/**
 * Report a detected threat to Maiat Protocol.
 * Fire-and-forget — never throws, never blocks the main flow.
 *
 * PRIVACY: Only sends attack characteristics. Never includes
 * sender address, transaction value, token amounts, or wallet state.
 */
export declare function reportThreat(maliciousAddress: string, threatType: ThreatReport['threatType'], evidence: Record<string, unknown>, apiKey?: string, chainId?: number): void;
//# sourceMappingURL=report-threat.d.ts.map