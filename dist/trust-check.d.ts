import type { MaiatCheckResult } from './types.js';
/**
 * Check trust score for an address via Maiat Protocol API.
 * Uses GET /api/v1/agent/{address} (canonical endpoint).
 */
export declare function checkTrust(address: string, apiKey?: string): Promise<MaiatCheckResult | null>;
//# sourceMappingURL=trust-check.d.ts.map