import { createWalletClient, custom } from 'viem';
import { base } from 'viem/chains';
import { withMaiatTrust } from './index.js';
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
export function createMaiatAgentWallet(provider, opts = {}) {
    const { chain = base, ...trustOpts } = opts;
    const client = createWalletClient({
        chain,
        transport: custom(provider),
    });
    return withMaiatTrust(client, {
        // Sensible agent defaults
        mode: 'block',
        minScore: 70,
        recordOutcomes: true,
        reportThreats: true,
        antiPoison: true,
        ...trustOpts,
    });
}
//# sourceMappingURL=agent-wallet.js.map