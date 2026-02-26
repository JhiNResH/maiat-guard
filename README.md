# @maiat/viem-guard

> Universal trust middleware for viem — automatically checks Maiat trust score before every transaction.

## Install

```bash
npm install @maiat/viem-guard viem
```

## Usage

```ts
import { createWalletClient, http, parseEther } from 'viem'
import { base } from 'viem/chains'
import { withMaiatTrust } from '@maiat/viem-guard'

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
})

// Wrap with Maiat trust gate
const client = withMaiatTrust(walletClient, {
  minScore: 60,  // block if trust score < 60 (default)
})

// All transactions now auto-checked
await client.sendTransaction({
  to: '0xSomeContract',
  value: parseEther('1'),
})
// ^ auto-calls GET /api/v1/trust-check?agent=0xSomeContract
// score < 60 → throws MaiatTrustError
// score ≥ 60 → tx proceeds normally
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minScore` | `number` | `60` | Block transactions to addresses below this trust score |
| `apiKey` | `string` | - | `mk_...` key for paid tier (no rate limit) |
| `mode` | `'block' \| 'warn' \| 'silent'` | `'block'` | How to handle low-trust addresses |
| `onWarn` | `(result) => void` | - | Called when `mode='warn'` and address is low-trust |

## Modes

```ts
// block (default) — throws MaiatTrustError
const client = withMaiatTrust(walletClient, { mode: 'block' })

// warn — logs warning, tx continues
const client = withMaiatTrust(walletClient, {
  mode: 'warn',
  onWarn: (result) => console.warn(`Low trust: ${result.address} (${result.score}/100)`),
})

// silent — disables all checks (for testing)
const client = withMaiatTrust(walletClient, { mode: 'silent' })
```

## Error handling

```ts
import { withMaiatTrust, MaiatTrustError } from '@maiat/viem-guard'

try {
  await client.sendTransaction({ to: '0x...', value: parseEther('1') })
} catch (e) {
  if (e instanceof MaiatTrustError) {
    console.log(e.address)  // blocked address
    console.log(e.score)    // 0-100
    console.log(e.verdict)  // 'block'
  }
}
```

## What gets intercepted

| tx.to | Trust check |
|-------|-------------|
| DeFi protocol | Protocol trust score |
| Agent wallet | ACP seller reputation |
| NFT contract | Contract safety |
| ERC-20 token | Token trust score |

Both `sendTransaction` and `writeContract` are intercepted. Unknown addresses (not in Maiat DB) are **allowed through** (fail-open).

## Rate limits

| Tier | Limit | How |
|------|-------|-----|
| Free | 10 req/min per IP | Default, no setup |
| Paid | Unlimited | `apiKey: 'mk_...'` |

## Powered by

[Maiat Protocol](https://maiat-protocol.vercel.app) — trust infrastructure for agentic commerce
