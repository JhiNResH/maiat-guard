import { checkTrust } from './trust-check.js';
import { MaiatTrustError } from './errors.js';
export { MaiatTrustError } from './errors.js';
/**
 * Wraps a viem WalletClient to auto-check Maiat trust score
 * before every sendTransaction / writeContract call.
 *
 * @example
 * const client = withMaiatTrust(walletClient, { minScore: 60 })
 * await client.sendTransaction({ to: '0x...', value: parseEther('1') })
 */
export function withMaiatTrust(client, opts = {}) {
    const { minScore = 60, apiKey, mode = 'block', onWarn } = opts;
    if (mode === 'silent')
        return client;
    async function gate(address) {
        if (!address)
            return;
        const result = await checkTrust(address, apiKey);
        // null = unknown address or API error → fail-open
        if (!result)
            return;
        const isLowTrust = result.verdict === 'block' || result.score < minScore;
        if (!isLowTrust)
            return;
        if (mode === 'block') {
            throw new MaiatTrustError(result);
        }
        if (mode === 'warn') {
            onWarn?.(result);
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return client.extend((c) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async sendTransaction(args) {
            await gate(args.to);
            return c.sendTransaction(args);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async writeContract(args) {
            await gate(args.address);
            return c.writeContract(args);
        },
    }));
}
//# sourceMappingURL=index.js.map