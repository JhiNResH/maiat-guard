import type { WalletClient } from 'viem'
import { checkTrust } from './trust-check.js'
import { MaiatTrustError, type MaiatCheckResult } from './errors.js'

export { MaiatTrustError } from './errors.js'
export type { MaiatCheckResult } from './errors.js'

export interface MaiatTrustOptions {
  /**
   * Block transactions to addresses with trust score below this threshold.
   * @default 60
   */
  minScore?: number

  /**
   * Maiat API key for paid tier (no rate limit).
   * Without key: free tier, 10 req/min per IP.
   */
  apiKey?: string

  /**
   * How to handle low-trust addresses.
   * - 'block'  → throws MaiatTrustError (default)
   * - 'warn'   → calls onWarn(), tx continues
   * - 'silent' → no check, passthrough
   */
  mode?: 'block' | 'warn' | 'silent'

  /**
   * Called when mode='warn' and address is low-trust.
   */
  onWarn?: (result: MaiatCheckResult) => void
}

/**
 * Wraps a viem WalletClient to auto-check Maiat trust score
 * before every sendTransaction / writeContract call.
 *
 * @example
 * const client = withMaiatTrust(walletClient, { minScore: 60 })
 * await client.sendTransaction({ to: '0x...', value: parseEther('1') })
 */
export function withMaiatTrust<T extends WalletClient>(
  client: T,
  opts: MaiatTrustOptions = {}
): T {
  const { minScore = 60, apiKey, mode = 'block', onWarn } = opts

  if (mode === 'silent') return client

  async function gate(address: string | undefined): Promise<void> {
    if (!address) return

    const result = await checkTrust(address, apiKey)

    // null = unknown address or API error → fail-open
    if (!result) return

    const isLowTrust = result.verdict === 'block' || result.score < minScore

    if (!isLowTrust) return

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
      await gate(args.to as string | undefined)
      return c.sendTransaction(args)
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async writeContract(args: any) {
      await gate(args.address as string)
      return c.writeContract(args)
    },
  })) as T
}
