# @maiat/viem-guard v0.2.0

> Agentic trust layer for viem — trust scoring, anti-poisoning, TrustGateHook integration, and threat reporting.

## Install

```bash
npm install @maiat/viem-guard viem
```

## Quick Start

```ts
import { createWalletClient, http, parseEther } from 'viem'
import { base } from 'viem/chains'
import { withMaiatTrust } from '@maiat/viem-guard'

const client = withMaiatTrust(walletClient, {
  minScore: 60,
  antiPoison: true,       // detect address poisoning
  reportThreats: true,    // auto-report to Maiat network
})

await client.sendTransaction({
  to: '0xSomeContract',
  value: parseEther('1'),
})
```

## Agent Wallet (Privy / EIP-1193)

One-line integration for AI agent wallets:

```ts
import { createMaiatAgentWallet } from '@maiat/viem-guard'

const wallet = createMaiatAgentWallet(privyProvider, {
  minScore: 70,
  antiPoison: true,
  apiKey: 'mk_...',
})

// All transactions: trust-gated + anti-poisoned + threat-reported
await wallet.sendTransaction({ to, value })
```

## TrustGateHook Integration (Uniswap V4)

Fetch EIP-712 signed scores for TrustGateHook-protected pools:

```ts
import { fetchSignedScore, encodeSwapHookData } from '@maiat/viem-guard'

// Fetch signed trust scores for both tokens
const score0 = await fetchSignedScore('0xToken0Address')
const score1 = await fetchSignedScore('0xToken1Address')

if (score0 && score1) {
  const hookData = encodeSwapHookData(myAddress, score0, score1)
  // Pass hookData to your Uniswap V4 swap transaction
}
```

## Anti-Poisoning Engine

Detects address poisoning attacks before they happen:

- **Vanity Match Detection**: Scans wallet history for addresses with matching first4+last4 hex chars
- **Liveness Check**: Flags accounts created <24h ago with dust-only transactions

```ts
const client = withMaiatTrust(walletClient, {
  antiPoison: {
    vanityMatch: true,
    livenessCheck: true,
    etherscanApiKey: 'YOUR_KEY',
    explorerUrl: 'https://api.basescan.org/api',
  },
})
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minScore` | `number` | `60` | Block if trust score below threshold |
| `apiKey` | `string` | - | `mk_...` key for paid tier |
| `mode` | `'block' \| 'warn' \| 'silent'` | `'block'` | How to handle low-trust |
| `onWarn` | `(result) => void` | - | Called in warn mode |
| `recordOutcomes` | `boolean` | `false` | Record tx outcomes to Maiat |
| `antiPoison` | `boolean \| AntiPoisonConfig` | `false` | Enable anti-poisoning |
| `reportThreats` | `boolean` | `true` | Auto-report threats to network |
| `routerAddresses` | `string[]` | - | Uniswap V4 router addresses |
| `feeTarget` | `string` | - | Address for fee discount |

## Error Handling

```ts
import { withMaiatTrust, MaiatTrustError, MaiatPoisonError } from '@maiat/viem-guard'

try {
  await client.sendTransaction({ to: '0x...', value: parseEther('1') })
} catch (e) {
  if (e instanceof MaiatPoisonError) {
    console.log(e.threatType)      // 'vanity_match' | 'dust_liveness'
    console.log(e.matchedAddress)  // the real address being impersonated
  }
  if (e instanceof MaiatTrustError) {
    console.log(e.score)           // 0-100
    console.log(e.verdict)         // 'block'
  }
}
```

## Collective Immunity

When Guard blocks an attack, it automatically reports the malicious address to the Maiat network (privacy-safe — no sender context). Every Maiat-protected agent gets instant protection.

```
Agent A blocks attack → Report to Maiat → Global TrustScore update → All agents immunized
```

## Exports

```ts
// Core
export { withMaiatTrust } from '@maiat/viem-guard'
export { createMaiatAgentWallet } from '@maiat/viem-guard'

// Hook Data
export { fetchSignedScore, encodeSwapHookData } from '@maiat/viem-guard'

// Anti-Poisoning
export { detectVanityMatch } from '@maiat/viem-guard'

// Threat Reporting
export { reportThreat } from '@maiat/viem-guard'

// Trust Check
export { checkTrust } from '@maiat/viem-guard'

// Types & Errors
export { MaiatTrustError, MaiatPoisonError } from '@maiat/viem-guard'
export type { MaiatCheckResult, SignedScore, AntiPoisonConfig, ThreatReport } from '@maiat/viem-guard'
```

## Powered by

[Maiat Protocol](https://maiat-protocol.vercel.app) — trust infrastructure for agentic commerce
