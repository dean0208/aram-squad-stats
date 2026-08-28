export type GrowthStatus = '폼다죽' | '아쉬워' | '좋은데?' | '버스기사님'

export function getGrowthStatus(allAverage: number, recentAverage: number): GrowthStatus {
  if (allAverage <= 0) return '좋은데?'

  const changeRate = (recentAverage - allAverage) / allAverage
  if (changeRate < -0.15) return '폼다죽'
  if (changeRate < 0) return '아쉬워'
  if (changeRate < 0.15) return '좋은데?'
  return '버스기사님'
}
