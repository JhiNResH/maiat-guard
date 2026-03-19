import { MaiatPoisonError } from './types.js'
import type { AntiPoisonConfig } from './types.js'

const DEFAULT_EXPLORER = 'https://api.basescan.org/api'
const TIMEOUT_MS = 3000

/**
 * Check if `target` is a vanity match for any address in `knownAddresses`.
 * Match rule: first 4 hex chars + last 4 hex chars are identical, but middle differs.
 * This is the primary pattern for address poisoning attacks.
 */
export function detectVanityMatch(
  target: string,
  knownAddresses: string[]
): string | null {
  const t = target.toLowerCase().replace('0x', '')
  if (t.length !== 40) return null

  const tPrefix = t.slice(0, 4)
  const tSuffix = t.slice(-4)

  for (const known of knownAddresses) {
    const k = known.toLowerCase().replace('0x', '')
    if (k.length !== 40) continue
    if (k === t) continue // same address, not a match

    if (k.slice(0, 4) === tPrefix && k.slice(-4) === tSuffix) {
      return `0x${k}`
    }
  }

  return null
}

/**
 * Fetch recent transaction counterparties for a wallet.
 * Returns the last N unique `to` addresses from the wallet's history.
 */
async function fetchRecentCounterparties(
  walletAddress: string,
  config: AntiPoisonConfig
): Promise<string[]> {
  const explorerUrl = config.explorerUrl ?? DEFAULT_EXPLORER
  const apiKey = config.etherscanApiKey ?? ''

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const url = `${explorerUrl}?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=${apiKey}`
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))

    if (!res.ok) return []
    const json = await res.json()
    if (json.status !== '1' || !Array.isArray(json.result)) return []

    const addresses = new Set<string>()
    for (const tx of json.result) {
      if (tx.to) addresses.add(tx.to.toLowerCase())
      if (tx.from) addresses.add(tx.from.toLowerCase())
    }
    // Remove the wallet itself
    addresses.delete(walletAddress.toLowerCase())
    return [...addresses]
  } catch {
    return []
  }
}

/**
 * Check if an address looks like a freshly created dust account.
 * Criteria: account created < 24h ago AND only has dust transactions (< 0.001 ETH).
 */
async function checkLiveness(
  address: string,
  config: AntiPoisonConfig
): Promise<{ suspicious: boolean; accountAge?: number; dustOnly?: boolean }> {
  const explorerUrl = config.explorerUrl ?? DEFAULT_EXPLORER
  const apiKey = config.etherscanApiKey ?? ''

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const url = `${explorerUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=asc&apikey=${apiKey}`
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))

    if (!res.ok) return { suspicious: false }
    const json = await res.json()

    // No transactions at all → unknown, not necessarily suspicious
    if (json.status !== '1' || !Array.isArray(json.result) || json.result.length === 0) {
      return { suspicious: false }
    }

    const txs = json.result
    const firstTxTime = parseInt(txs[0].timeStamp, 10) * 1000
    const accountAge = Date.now() - firstTxTime
    const isNew = accountAge < 24 * 60 * 60 * 1000 // < 24 hours

    // Check if all transactions are dust (< 0.001 ETH = 1e15 wei)
    const DUST_THRESHOLD = BigInt('1000000000000000') // 0.001 ETH
    const dustOnly = txs.every((tx: { value: string }) => {
      try {
        return BigInt(tx.value) < DUST_THRESHOLD
      } catch {
        return true
      }
    })

    return {
      suspicious: isNew && dustOnly,
      accountAge: Math.floor(accountAge / 1000),
      dustOnly,
    }
  } catch {
    return { suspicious: false }
  }
}

/**
 * Run anti-poisoning checks on a target address.
 * Throws MaiatPoisonError if poisoning is detected.
 */
export async function antiPoisonGate(
  targetAddress: string,
  walletAddress: string | undefined,
  config: AntiPoisonConfig
): Promise<void> {
  const vanityEnabled = config.vanityMatch !== false
  const livenessEnabled = config.livenessCheck !== false

  // 1. Vanity match detection
  if (vanityEnabled && walletAddress) {
    const counterparties = await fetchRecentCounterparties(walletAddress, config)
    if (counterparties.length > 0) {
      const matched = detectVanityMatch(targetAddress, counterparties)
      if (matched) {
        throw new MaiatPoisonError(targetAddress, 'vanity_match', matched)
      }
    }
  }

  // 2. Liveness check for new accounts
  if (livenessEnabled && config.etherscanApiKey) {
    const liveness = await checkLiveness(targetAddress, config)
    if (liveness.suspicious) {
      throw new MaiatPoisonError(targetAddress, 'dust_liveness')
    }
  }
}
