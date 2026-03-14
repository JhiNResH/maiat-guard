import { createWalletClient, type WalletClient, type EIP1193Provider } from 'viem';
import type { MaiatTrustOptions } from './types.js';
export interface AgentWalletOptions extends MaiatTrustOptions {
    /** viem Chain object (defaults to Base) */
    chain?: Parameters<typeof createWalletClient>[0]['chain'];
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
export declare function createMaiatAgentWallet(provider: EIP1193Provider, opts?: AgentWalletOptions): WalletClient;
//# sourceMappingURL=agent-wallet.d.ts.map