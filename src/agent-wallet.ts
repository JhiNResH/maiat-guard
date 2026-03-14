import { createWalletClient, custom, type WalletClient, type EIP1193Provider } from 'viem'
import { base } from 'viem/chains'
import { withMaiatTrust } from './index.js'
import type { MaiatTrustOptions } from './types.js'

export interface AgentWalletOptions extends MaiatTrustOptions {
  /** viem Chain object (defaults to Base) */
  chain?: Parameters<typeof createWalletClient>[0]['chain']
}

/**
 * Create a Maiat-guarded wallet from any EIP-1193 provider.
 * One-line integration for Privy, MetaMask, or any wallet provider.
 *
 * @example
 * ```ts
 * import { createMaiatAgentWallet } from '@maiat/viem-guard'
 *
 * const wallet = createMaiatAgentWallet(privyProvider, {
 *   minScore: 70,
 *   antiPoison: true,
 *   apiKey: 'mk_...',
 * })
 *
 * await wallet.sendTransaction({ to: '0x...', value: parseEther('1') })
 * ```
 */
export function createMaiatAgentWallet(
  provider: EIP1193Provider,
  opts: AgentWalletOptions = {}
): WalletClient {
  const { chain = base, ...trustOpts } = opts

  const client = createWalletClient({
    chain,
    transport: custom(provider),
  })

  return withMaiatTrust(client, {
    // Sensible agent defaults
    mode: 'block',
    minScore: 70,
    recordOutcomes: true,
    reportThreats: true,
    antiPoison: true,
    ...trustOpts,
  })
}
