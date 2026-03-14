const MAIAT_API = 'https://maiat-protocol.vercel.app';
const GUARD_VERSION = '0.2.0';
/**
 * Report a detected threat to Maiat Protocol.
 * Fire-and-forget — never throws, never blocks the main flow.
 *
 * PRIVACY: Only sends attack characteristics. Never includes
 * sender address, transaction value, token amounts, or wallet state.
 */
export function reportThreat(maliciousAddress, threatType, evidence, apiKey, chainId) {
    const report = {
        maliciousAddress,
        threatType,
        evidence,
        guardVersion: GUARD_VERSION,
        chainId,
        timestamp: Math.floor(Date.now() / 1000),
    };
    const headers = {
        'Content-Type': 'application/json',
    };
    if (apiKey)
        headers['X-Maiat-Key'] = apiKey;
    fetch(`${MAIAT_API}/api/v1/threat/report`, {
        method: 'POST',
        headers,
        body: JSON.stringify(report),
    }).catch(() => {
        // Silent — threat reporting must never break the main tx flow
    });
}
//# sourceMappingURL=report-threat.js.map