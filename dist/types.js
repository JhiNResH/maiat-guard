export class MaiatTrustError extends Error {
    constructor(result) {
        super(`Transaction blocked: ${result.address} has trust score ${result.score}/100 (${result.riskLevel} Risk)`);
        this.name = 'MaiatTrustError';
        this.address = result.address;
        this.score = result.score;
        this.riskLevel = result.riskLevel;
        this.verdict = result.verdict;
    }
}
export class MaiatPoisonError extends Error {
    constructor(address, threatType, matchedAddress) {
        const msg = threatType === 'vanity_match'
            ? `Address poisoning detected: ${address} is a vanity match for ${matchedAddress}`
            : `Suspicious address: ${address} — new account with dust-only history`;
        super(msg);
        this.name = 'MaiatPoisonError';
        this.address = address;
        this.matchedAddress = matchedAddress;
        this.threatType = threatType;
    }
}
//# sourceMappingURL=types.js.map