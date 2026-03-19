/**
 * ACP Wrap — middleware for Virtuals ACP client.
 *
 * Wraps any ACP client to auto-check provider trust before accepting jobs,
 * auto-set Maiat as evaluator on new jobs, and verify deliverables.
 */
import type { MaiatCheckResult } from './types.js';
export interface AcpWrapOptions {
    /** Minimum trust score to auto-accept a job from a provider. @default 60 */
    minProviderScore?: number;
    /** Auto-set Maiat as evaluator on createJob calls. @default true */
    autoEvaluator?: boolean;
    /** Custom evaluator address (defaults to Maiat). */
    evaluatorAddress?: string;
    /** Maiat API key for higher rate limits. */
    apiKey?: string;
    /** How to handle low-trust providers.
     * - 'block' → reject job (default)
     * - 'warn'  → call onWarn, continue
     * - 'silent' → no checks
     */
    mode?: 'block' | 'warn' | 'silent';
    /** Called when mode='warn' and provider is low-trust. */
    onProviderWarn?: (provider: string, result: MaiatCheckResult) => void;
    /** Called before every job acceptance with trust data. Return false to reject. */
    onBeforeAccept?: (job: AcpJobLike, trustResult: MaiatCheckResult | null) => boolean | Promise<boolean>;
    /** Check token safety for token-related job requirements. @default true */
    tokenGuard?: boolean;
}
/** Minimal ACP job shape — compatible with any ACP client. */
export interface AcpJobLike {
    id?: number | string;
    providerAddress?: string;
    buyerAddress?: string;
    evaluatorAddress?: string;
    requirements?: Record<string, unknown>;
    deliverable?: string;
    [key: string]: unknown;
}
/** Minimal ACP client interface — works with acp-node or openclaw-acp. */
export interface AcpClientLike {
    createJob?: (params: Record<string, unknown>) => Promise<unknown>;
    acceptJob?: (jobId: number | string, ...args: unknown[]) => Promise<unknown>;
    [key: string]: unknown;
}
/**
 * Wrap an ACP client with Maiat trust checks.
 *
 * @example
 * ```ts
 * import { withMaiatAcp } from '@maiat/viem-guard'
 *
 * const safeAcp = withMaiatAcp(acpClient, {
 *   minProviderScore: 60,
 *   autoEvaluator: true,
 * })
 *
 * // createJob → auto-adds evaluatorAddress = Maiat
 * await safeAcp.createJob({ provider: '0x...', offering: 'task' })
 *
 * // acceptJob → auto-checks provider trust first
 * await safeAcp.acceptJob(jobId)
 * ```
 */
export declare function withMaiatAcp<T extends AcpClientLike>(client: T, opts?: AcpWrapOptions): T;
export declare class MaiatAcpError extends Error {
    readonly address: string;
    readonly trustResult: MaiatCheckResult | null;
    constructor(message: string, address: string, trustResult: MaiatCheckResult | null);
}
//# sourceMappingURL=acp-wrap.d.ts.map