/**
 * ACP Wrap — middleware for Virtuals ACP client.
 *
 * Wraps any ACP client to auto-check provider trust before accepting jobs,
 * auto-set Maiat as evaluator on new jobs, and verify deliverables.
 */

import { checkTrust } from './trust-check.js'
import { checkToken } from './token-guard.js'
import type { MaiatCheckResult } from './types.js'

const MAIAT_EVALUATOR_WALLET = '0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AcpWrapOptions {
  /** Minimum trust score to auto-accept a job from a provider. @default 60 */
  minProviderScore?: number

  /** Auto-set Maiat as evaluator on createJob calls. @default true */
  autoEvaluator?: boolean

  /** Custom evaluator address (defaults to Maiat). */
  evaluatorAddress?: string

  /** Maiat API key for higher rate limits. */
  apiKey?: string

  /** How to handle low-trust providers.
   * - 'block' → reject job (default)
   * - 'warn'  → call onWarn, continue
   * - 'silent' → no checks
   */
  mode?: 'block' | 'warn' | 'silent'

  /** Called when mode='warn' and provider is low-trust. */
  onProviderWarn?: (provider: string, result: MaiatCheckResult) => void

  /** Called before every job acceptance with trust data. Return false to reject. */
  onBeforeAccept?: (job: AcpJobLike, trustResult: MaiatCheckResult | null) => boolean | Promise<boolean>

  /** Check token safety for token-related job requirements. @default true */
  tokenGuard?: boolean
}

/** Minimal ACP job shape — compatible with any ACP client. */
export interface AcpJobLike {
  id?: number | string
  providerAddress?: string
  buyerAddress?: string
  evaluatorAddress?: string
  requirements?: Record<string, unknown>
  deliverable?: string
  [key: string]: unknown
}

/** Minimal ACP client interface — works with acp-node or openclaw-acp. */
export interface AcpClientLike {
  createJob?: (params: Record<string, unknown>) => Promise<unknown>
  acceptJob?: (jobId: number | string, ...args: unknown[]) => Promise<unknown>
  [key: string]: unknown
}

// ── Wrap ──────────────────────────────────────────────────────────────────────

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
export function withMaiatAcp<T extends AcpClientLike>(
  client: T,
  opts: AcpWrapOptions = {}
): T {
  const {
    minProviderScore = 60,
    autoEvaluator = true,
    evaluatorAddress = MAIAT_EVALUATOR_WALLET,
    apiKey,
    mode = 'block',
    onProviderWarn,
    onBeforeAccept,
    tokenGuard = true,
  } = opts

  if (mode === 'silent') return client

  // Proxy to intercept method calls
  return new Proxy(client, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver)

      // Intercept createJob — inject evaluator
      if (prop === 'createJob' && typeof original === 'function') {
        return async function wrappedCreateJob(params: Record<string, unknown>) {
          // Auto-set evaluator if not already specified
          if (autoEvaluator && !params.evaluatorAddress && !params.evaluator) {
            params.evaluatorAddress = evaluatorAddress
          }

          // Check provider trust if specified
          const providerAddr = (params.providerAddress ?? params.provider) as string | undefined
          if (providerAddr) {
            const result = await checkTrust(providerAddr, apiKey)
            if (result) {
              const isLowTrust = result.verdict === 'block' || result.score < minProviderScore
              if (isLowTrust) {
                if (mode === 'block') {
                  throw new MaiatAcpError(
                    `Job creation blocked: provider ${providerAddr} has trust score ${result.score}/100`,
                    providerAddr,
                    result
                  )
                }
                if (mode === 'warn') {
                  onProviderWarn?.(providerAddr, result)
                }
              }
            }
          }

          // Token guard: check token addresses in requirements
          if (tokenGuard && params.requirements) {
            const reqs = params.requirements as Record<string, unknown>
            for (const key of ['token', 'tokenAddress', 'tokenOut', 'tokenIn']) {
              const addr = reqs[key]
              if (typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr)) {
                const tokenResult = await checkToken(addr, apiKey)
                if (tokenResult && (tokenResult.verdict === 'danger' || tokenResult.isHoneypot)) {
                  if (mode === 'block') {
                    throw new MaiatAcpError(
                      `Job creation blocked: token ${addr} is dangerous — ${tokenResult.riskSummary}`,
                      addr,
                      null
                    )
                  }
                }
              }
            }
          }

          return (original as Function).call(target, params)
        }
      }

      // Intercept acceptJob — check provider trust
      if (prop === 'acceptJob' && typeof original === 'function') {
        return async function wrappedAcceptJob(jobId: number | string, ...args: unknown[]) {
          // If first extra arg is a job object with providerAddress, check it
          const jobObj = args[0] as AcpJobLike | undefined
          const providerAddr = jobObj?.providerAddress

          if (providerAddr) {
            const result = await checkTrust(providerAddr, apiKey)

            // Custom gate
            if (onBeforeAccept) {
              const allowed = await onBeforeAccept(jobObj, result)
              if (!allowed) {
                throw new MaiatAcpError(
                  `Job ${jobId} rejected by onBeforeAccept hook`,
                  providerAddr,
                  result
                )
              }
            }

            if (result) {
              const isLowTrust = result.verdict === 'block' || result.score < minProviderScore
              if (isLowTrust) {
                if (mode === 'block') {
                  throw new MaiatAcpError(
                    `Job ${jobId} rejected: provider ${providerAddr} trust score ${result.score}/100`,
                    providerAddr,
                    result
                  )
                }
                if (mode === 'warn') {
                  onProviderWarn?.(providerAddr, result)
                }
              }
            }
          }

          return (original as Function).call(target, jobId, ...args)
        }
      }

      return original
    },
  }) as T
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class MaiatAcpError extends Error {
  readonly address: string
  readonly trustResult: MaiatCheckResult | null

  constructor(message: string, address: string, trustResult: MaiatCheckResult | null) {
    super(message)
    this.name = 'MaiatAcpError'
    this.address = address
    this.trustResult = trustResult
  }
}
