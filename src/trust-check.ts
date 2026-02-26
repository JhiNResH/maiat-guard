import type { MaiatCheckResult } from './errors.js'

const MAIAT_API = 'https://maiat-protocol.vercel.app'
const TIMEOUT_MS = 2000

// Simple in-memory cache: address → { result, expiresAt }
const cache = new Map<string, { result: MaiatCheckResult; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function checkTrust(
  address: string,
  apiKey?: string
): Promise<MaiatCheckResult | null> {
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null

  const lowerAddr = address.toLowerCase()

  // Cache hit
  const cached = cache.get(lowerAddr)
  if (cached && Date.now() < cached.expiresAt) {
    return { ...cached.result, source: 'cache' }
  }

  try {
    const headers: Record<string, string> = {}
    if (apiKey) headers['X-Maiat-Key'] = apiKey

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(
      `${MAIAT_API}/api/v1/trust-check?agent=${lowerAddr}`,
      { headers, signal: controller.signal }
    ).finally(() => clearTimeout(timer))

    // 404 or unknown = not in DB → fail-open
    if (res.status === 404 || res.status === 402) return null

    if (!res.ok) return null

    const json = await res.json()
    const result: MaiatCheckResult = {
      address: lowerAddr,
      score: json.score ?? json.trustScore ?? 0,
      riskLevel: json.riskLevel ?? 'Unknown',
      verdict: json.verdict ?? 'allow',
      source: 'api',
    }

    cache.set(lowerAddr, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  } catch {
    // Timeout or network error → fail-open
    return null
  }
}
