const MAIAT_API = 'https://maiat-protocol.vercel.app';
const TIMEOUT_MS = 3000;
/**
 * Fetch an EIP-712 signed trust score from Maiat oracle.
 * The signature can be included in Uniswap V4 swap hookData
 * for on-chain verification by TrustGateHook.
 */
export async function fetchSignedScore(token, apiKey) {
    if (!token || !/^0x[0-9a-fA-F]{40}$/.test(token))
        return null;
    try {
        const headers = { Accept: 'application/json' };
        if (apiKey)
            headers['X-Maiat-Key'] = apiKey;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const res = await fetch(`${MAIAT_API}/api/v1/oracle/sign?token=${token.toLowerCase()}`, { headers, signal: controller.signal }).finally(() => clearTimeout(timer));
        if (!res.ok)
            return null;
        const json = await res.json();
        return {
            token: token.toLowerCase(),
            score: json.score ?? 0,
            timestamp: json.timestamp ?? 0,
            nonce: json.nonce ?? 0,
            signature: json.signature ?? '0x',
            hookDataHex: json.hookDataHex,
        };
    }
    catch {
        return null;
    }
}
/**
 * Encode two signed scores + fee target into hookData for TrustGateHook.
 *
 * hookData format (TrustGateHook._decodeSignedHookData):
 *   abi.encode(
 *     address feeTarget,
 *     uint256 score0, uint256 timestamp0, uint256 nonce0, bytes signature0,
 *     uint256 score1, uint256 timestamp1, uint256 nonce1, bytes signature1
 *   )
 */
export function encodeSwapHookData(feeTarget, score0, score1) {
    // Pad address to 32 bytes (left-padded with zeros)
    const feeTargetPadded = feeTarget.toLowerCase().replace('0x', '').padStart(64, '0');
    // Encode fixed-size fields
    const s0Score = BigInt(score0.score).toString(16).padStart(64, '0');
    const s0Ts = BigInt(score0.timestamp).toString(16).padStart(64, '0');
    const s0Nonce = BigInt(score0.nonce).toString(16).padStart(64, '0');
    const s1Score = BigInt(score1.score).toString(16).padStart(64, '0');
    const s1Ts = BigInt(score1.timestamp).toString(16).padStart(64, '0');
    const s1Nonce = BigInt(score1.nonce).toString(16).padStart(64, '0');
    // Signatures (dynamic bytes) — need ABI offset encoding
    const sig0Hex = score0.signature.startsWith('0x') ? score0.signature.slice(2) : score0.signature;
    const sig1Hex = score1.signature.startsWith('0x') ? score1.signature.slice(2) : score1.signature;
    // Calculate offsets for dynamic bytes
    // Fixed part: feeTarget(32) + score0(32) + ts0(32) + nonce0(32) + sig0_offset(32) +
    //             score1(32) + ts1(32) + nonce1(32) + sig1_offset(32) = 9 * 32 = 288 = 0x120
    // sig0 starts at offset 288
    const sig0Len = sig0Hex.length / 2;
    const sig0Padded = sig0Hex.padEnd(Math.ceil(sig0Hex.length / 64) * 64, '0');
    // sig1 starts at 288 + 32 (sig0 length prefix) + ceil(sig0Len/32)*32
    const sig0PaddedBytes = sig0Padded.length / 2;
    const sig1Start = 288 + 32 + sig0PaddedBytes;
    const sig0Offset = (288).toString(16).padStart(64, '0');
    const sig1Offset = sig1Start.toString(16).padStart(64, '0');
    const sig0LenHex = sig0Len.toString(16).padStart(64, '0');
    const sig1Len = sig1Hex.length / 2;
    const sig1LenHex = sig1Len.toString(16).padStart(64, '0');
    const sig1Padded = sig1Hex.padEnd(Math.ceil(sig1Hex.length / 64) * 64, '0');
    // Assemble: the ABI encoding uses abi.decode with mixed static + dynamic types
    // Since TrustGateHook uses abi.decode(hookData, (address, uint256, uint256, uint256, bytes, uint256, uint256, uint256, bytes))
    // the encoding follows standard ABI rules:
    // - Static types are encoded in place (head part)
    // - Dynamic types (bytes) get an offset pointer in the head, data in the tail
    const head = [
        feeTargetPadded, // address feeTarget
        s0Score, // uint256 score0
        s0Ts, // uint256 timestamp0
        s0Nonce, // uint256 nonce0
        sig0Offset, // bytes signature0 (offset)
        s1Score, // uint256 score1
        s1Ts, // uint256 timestamp1
        s1Nonce, // uint256 nonce1
        sig1Offset, // bytes signature1 (offset)
    ].join('');
    const tail = [
        sig0LenHex, // sig0 length
        sig0Padded, // sig0 data
        sig1LenHex, // sig1 length
        sig1Padded, // sig1 data
    ].join('');
    return `0x${head}${tail}`;
}
//# sourceMappingURL=hook-data.js.map