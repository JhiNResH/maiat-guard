import type { ThreatReport } from './types.js'

const MAIAT_API = 'https://app.maiat.io'
const GUARD_VERSION = '0.2.0'

/**
 * Report a detected threat to Maiat Protocol.
 * Fire-and-forget — never throws, never blocks the main flow.
 *
 * PRIVACY: Only sends attack characteristics. Never includes
 * sender address, transaction value, token amounts, or wallet state.
 */
export function reportThreat(
  maliciousAddress: string,
  threatType: ThreatReport['threatType'],
  evidence: Record<string, unknown>,
  apiKey?: string,
  chainId?: number
): void {
  const report: ThreatReport = {
    maliciousAddress,
    threatType,
    evidence,
    guardVersion: GUARD_VERSION,
    chainId,
    timestamp: Math.floor(Date.now() / 1000),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers['X-Maiat-Key'] = apiKey

  fetch(`${MAIAT_API}/api/v1/threat/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify(report),
  }).catch(() => {
    // Silent — threat reporting must never break the main tx flow
  })
}
