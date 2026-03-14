export interface MaiatCheckResult {
  address: string
  score: number
  riskLevel: 'Low' | 'Medium' | 'High' | 'Unknown'
  verdict: 'allow' | 'review' | 'block'
  source: 'api' | 'cache' | 'fallback'
}

export class MaiatTrustError extends Error {
  readonly address: string
  readonly score: number
  readonly riskLevel: string
  readonly verdict: string

  constructor(result: MaiatCheckResult) {
    super(
      `Transaction blocked: ${result.address} has trust score ${result.score}/100 (${result.riskLevel} Risk)`
    )
    this.name = 'MaiatTrustError'
    this.address = result.address
    this.score = result.score
    this.riskLevel = result.riskLevel
    this.verdict = result.verdict
  }
}
