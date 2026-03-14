import type { WalletClient } from 'viem'
import { checkTrust } from './trust-check.js'
import { antiPoisonGate } from './anti-poison.js'
import { reportThreat } from './report-threat.js'
import type { MaiatTrustOptions, MaiatCheckResult, AntiPoisonConfig } from './types.js'
import { MaiatTrustError, MaiatPoisonError } from './types.js'

// Re-exports
export { MaiatTrustError, MaiatPoisonError } from './types.js'
export type { MaiatCheckResult, MaiatTrustOptions, SignedScore, AntiPoisonConfig, ThreatReport } from './types.js'
export { checkTrust } from './trust-check.js'
export { fetchSignedScore, encodeSwapHookData } from './hook-data.js'
export { detectVanityMatch } from './anti-poison.js'
export { reportThreat } from './report-threat.js'
export { createMaiatAgentWallet } from './agent-wallet.js'

const MAIAT_API = 'https://maiat-protocol.vercel.app'

/**
 * Fire-and-forget outcome recording after a transaction.
 */
function recordOutcome(
  agentAddress: string,
  outcome: 'success' | 'failure',
  apiKey: string,
  txHash?: string
): void {
  fetch(`${MAIAT_API}/api/v1/outcome`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Maiat-Key': apiKey,
    },
    body: JSON.stringify({
      jobId: txHash ?? `guard-${Date.now()}`,
      agentAddress,
      outcome,
      source: 'maiat-guard',
    }),
  }).catch(() => {})
}

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
export function withMaiatTrust<T extends WalletClient>(
  client: T,
  opts: MaiatTrustOptions = {}
): T {
  const {
    minScore = 60,
    apiKey,
    mode = 'block',
    onWarn,
    recordOutcomes: enableOutcomes = false,
    antiPoison = false,
    reportThreats = true,
  } = opts

  if (mode === 'silent') return client

  // Resolve anti-poison config
  const poisonConfig: AntiPoisonConfig | null = antiPoison
    ? (typeof antiPoison === 'object' ? antiPoison : { vanityMatch: true, livenessCheck: true })
    : null

  async function gate(address: string | undefined): Promise<void> {
    if (!address) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletAddress = (client as any).account?.address as string | undefined

    // 1. Anti-poisoning checks (before trust check — cheaper to fail fast)
    if (poisonConfig) {
      try {
        await antiPoisonGate(address, walletAddress, poisonConfig)
      } catch (err) {
        if (err instanceof MaiatPoisonError) {
          // Report threat
          if (reportThreats) {
            reportThreat(
              address,
              err.threatType === 'vanity_match' ? 'vanity_match' : 'dust_liveness',
              {
                matchedAddress: err.matchedAddress,
                threatType: err.threatType,
              },
              apiKey
            )
          }
          if (mode === 'block') throw err
          if (mode === 'warn') {
            onWarn?.({
              address,
              score: 0,
              riskLevel: 'High',
              verdict: 'block',
              source: 'fallback',
            })
            return
          }
        }
        // Other errors → fail-open
      }
    }

    // 2. Trust score check
    const result = await checkTrust(address, apiKey)

    // null = unknown address or API error → fail-open
    if (!result) return

    const isLowTrust = result.verdict === 'block' || result.score < minScore

    if (!isLowTrust) return

    // Report low-trust threat
    if (reportThreats) {
      reportThreat(
        address,
        'low_trust',
        { score: result.score, riskLevel: result.riskLevel, verdict: result.verdict },
        apiKey
      )
    }

    if (mode === 'block') {
      throw new MaiatTrustError(result)
    }

    if (mode === 'warn') {
      onWarn?.(result)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.extend((c: any) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async sendTransaction(args: any) {
      const to = args.to as string | undefined
      await gate(to)

      try {
        const txHash = await c.sendTransaction(args)
        if (enableOutcomes && apiKey && to) {
          recordOutcome(to, 'success', apiKey, txHash as string)
        }
        return txHash
      } catch (err) {
        if (enableOutcomes && apiKey && to) {
          recordOutcome(to, 'failure', apiKey)
        }
        throw err
      }
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async writeContract(args: any) {
      await gate(args.address as string)
      return c.writeContract(args)
    },
  })) as T
}
