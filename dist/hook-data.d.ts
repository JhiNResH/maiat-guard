import type { SignedScore } from './types.js';
/**
 * Fetch an EIP-712 signed trust score from Maiat oracle.
 * The signature can be included in Uniswap V4 swap hookData
 * for on-chain verification by TrustGateHook.
 */
export declare function fetchSignedScore(token: string, apiKey?: string): Promise<SignedScore | null>;
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
export declare function encodeSwapHookData(feeTarget: string, score0: SignedScore, score1: SignedScore): `0x${string}`;
//# sourceMappingURL=hook-data.d.ts.map