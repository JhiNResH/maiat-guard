/**
 * Token Guard — auto-checks token safety before swap transactions.
 *
 * Detects swap calldata (Uniswap V2/V3/V4, Universal Router), extracts
 * the output token address, and checks it against Maiat's token safety API.
 */

import type { MaiatCheckResult } from './types.js'

const MAIAT_API = 'https://app.maiat.io'
const TIMEOUT_MS = 3000

// Cache: tokenAddress → { result, expiresAt }
const tokenCache = new Map<string, { result: TokenCheckResult; expiresAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes (tokens change less frequently)

// ── Known Router Addresses (Base) ─────────────────────────────────────────────

const KNOWN_ROUTERS = new Set([
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', // Uniswap Universal Router (Base)
  '0x2626664c2603336e57b271c5c0b26f421741e481', // Uniswap V3 SwapRouter02 (Base)
  '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', // Uniswap V2 Router (Base)
  '0x198ef79f1f515f02dfe9e3115ed9fc07183f02fc', // Uniswap V4 PoolSwapTest
].map(a => a.toLowerCase()))

// ── Uniswap Function Selectors ────────────────────────────────────────────────

// Universal Router: execute(bytes,bytes[],uint256)
const EXECUTE_SELECTOR = '0x3593564c'
// V3 SwapRouter: exactInputSingle / exactOutputSingle
const EXACT_INPUT_SINGLE = '0x414bf389'
const EXACT_OUTPUT_SINGLE = '0xdb3e2198'
// V2 Router: swapExactTokensForTokens / swapExactETHForTokens
const SWAP_EXACT_TOKENS = '0x38ed1739'
const SWAP_EXACT_ETH = '0x7ff36ab5'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenCheckResult {
  address: string
  verdict: 'safe' | 'caution' | 'danger' | 'unknown'
  score: number
  riskFlags: string[]
  riskSummary: string
  isHoneypot: boolean
  source: 'api' | 'cache'
}

export class MaiatTokenError extends Error {
  readonly tokenAddress: string
  readonly score: number
  readonly verdict: string
  readonly riskFlags: string[]

  constructor(result: TokenCheckResult) {
    super(
      `Swap blocked: token ${result.address} is ${result.verdict} — ${result.riskSummary}`
    )
    this.name = 'MaiatTokenError'
    this.tokenAddress = result.address
    this.score = result.score
    this.verdict = result.verdict
    this.riskFlags = result.riskFlags
  }
}

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Check if a transaction target is a known DEX router.
 */
export function isSwapTransaction(to: string | undefined): boolean {
  if (!to) return false
  return KNOWN_ROUTERS.has(to.toLowerCase())
}

/**
 * Add a custom router address to detection list.
 */
export function addRouter(address: string): void {
  KNOWN_ROUTERS.add(address.toLowerCase())
}

/**
 * Extract output token address from swap calldata.
 * Returns null if calldata can't be parsed.
 */
export function extractTokenOut(data: string | undefined): string | null {
  if (!data || data.length < 10) return null

  const selector = data.slice(0, 10).toLowerCase()

  try {
    // Universal Router execute — complex, extract from commands
    if (selector === EXECUTE_SELECTOR) {
      return extractFromUniversalRouter(data)
    }

    // V3 exactInputSingle(ExactInputSingleParams)
    // struct: tokenIn(0), tokenOut(32), fee(64), recipient(96), ...
    if (selector === EXACT_INPUT_SINGLE || selector === EXACT_OUTPUT_SINGLE) {
      const tokenOut = '0x' + data.slice(74, 114) // offset 32 bytes = chars 10+64=74
      if (/^0x[0-9a-fA-F]{40}$/.test(tokenOut)) return tokenOut.toLowerCase()
    }

    // V2 swapExactTokensForTokens(uint256,uint256,address[],address,uint256)
    // path array is at dynamic offset — last element is tokenOut
    if (selector === SWAP_EXACT_TOKENS || selector === SWAP_EXACT_ETH) {
      return extractLastFromPath(data)
    }
  } catch {
    // Parse failure — can't extract token
  }

  return null
}

/**
 * Extract token from Universal Router execute() commands.
 * Simplified: looks for V3_SWAP_EXACT_IN (0x00) command.
 */
function extractFromUniversalRouter(data: string): string | null {
  // Universal Router encode is complex — scan for 40-char hex patterns after known offsets
  // Heuristic: find the last 20-byte address-like value in the calldata
  const hexBody = data.slice(10)
  const matches = hexBody.match(/([0-9a-fA-F]{64})/g)
  if (!matches) return null

  // Look for address-like values (first 24 chars are zeros = address padding)
  const addresses: string[] = []
  for (const m of matches) {
    if (m.startsWith('000000000000000000000000') && !m.endsWith('0000000000000000000000000000000000000000')) {
      const addr = '0x' + m.slice(24)
      if (/^0x[0-9a-fA-F]{40}$/.test(addr) && addr !== '0x0000000000000000000000000000000000000000') {
        addresses.push(addr.toLowerCase())
      }
    }
  }

  // Typically: [tokenIn, tokenOut, recipient, ...] — tokenOut is often 2nd unique address
  if (addresses.length >= 2) {
    return addresses[1] // tokenOut is usually the second address
  }

  return null
}

/**
 * Extract last address from V2-style path array.
 */
function extractLastFromPath(data: string): string | null {
  const hexBody = data.slice(10)
  const matches = hexBody.match(/000000000000000000000000([0-9a-fA-F]{40})/g)
  if (!matches || matches.length < 2) return null

  const last = matches[matches.length - 1]
  const addr = '0x' + last.slice(24)
  return addr.toLowerCase()
}

// ── API Check ─────────────────────────────────────────────────────────────────

/**
 * Check token safety via Maiat Protocol API.
 */
export async function checkToken(
  tokenAddress: string,
  apiKey?: string
): Promise<TokenCheckResult | null> {
  if (!tokenAddress || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) return null

  const lower = tokenAddress.toLowerCase()

  // Cache hit
  const cached = tokenCache.get(lower)
  if (cached && Date.now() < cached.expiresAt) {
    return { ...cached.result, source: 'cache' }
  }

  try {
    const headers: Record<string, string> = { 'X-Maiat-Client': 'maiat-guard' }
    if (apiKey) headers['X-Maiat-Key'] = apiKey

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(
      `${MAIAT_API}/api/v1/token/${lower}`,
      { headers, signal: controller.signal }
    ).finally(() => clearTimeout(timer))

    if (res.status === 404) return null
    if (!res.ok) return null

    const json = (await res.json()) as Record<string, unknown>

    const score = typeof json.trustScore === 'number' ? json.trustScore : 0
    const riskFlags = Array.isArray(json.riskFlags) ? json.riskFlags as string[] : []
    const riskSummary = typeof json.riskSummary === 'string' ? json.riskSummary : 'Unknown risk'
    const honeypot = json.honeypot as Record<string, unknown> | undefined
    const isHoneypot = honeypot?.isHoneypot === true
    const apiVerdict = typeof json.verdict === 'string' ? json.verdict : 'unknown'

    let verdict: TokenCheckResult['verdict'] = 'unknown'
    if (apiVerdict === 'proceed') verdict = 'safe'
    else if (apiVerdict === 'caution') verdict = 'caution'
    else if (apiVerdict === 'avoid') verdict = 'danger'

    if (isHoneypot) verdict = 'danger'

    const result: TokenCheckResult = {
      address: lower,
      verdict,
      score,
      riskFlags,
      riskSummary,
      isHoneypot,
      source: 'api',
    }

    tokenCache.set(lower, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  } catch {
    return null // fail-open
  }
}
