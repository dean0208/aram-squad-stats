/**
 * Converts the fair raw score into a more readable 0-100 display score.
 * The scoring model and stored raw score remain unchanged.
 */
export function toDisplayContributionScore(rawScore: number): number {
  if (rawScore <= 0) return 0
  return Math.min(100, Math.round(Math.sqrt(rawScore / 50) * 100))
}
