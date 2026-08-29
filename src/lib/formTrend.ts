export interface FormTrend {
  recentAverage: number
  baselineAverage: number
  delta: number
  message: string
}

export function calculateFormTrend(recentScores: number[], baselineScores: number[]): FormTrend {
  if (!recentScores.length) {
    return { recentAverage: 0, baselineAverage: 0, delta: 0, message: '최근 기록이 아직 없어요. 다음 판부터 흐름을 볼게요!' }
  }

  const average = (scores: number[]) => scores.reduce((sum, score) => sum + score, 0) / scores.length
  const recentAverage = average(recentScores)
  const baselineAverage = baselineScores.length ? average(baselineScores) : 50
  const delta = Math.round(recentAverage - baselineAverage)
  const message = delta >= 10
    ? '요즘 상승세인데요? 이 흐름 그대로 유지해보세요!'
    : delta <= -10
      ? '요즘 폼다죽... 너무 낙심 말고 다시 기운내봐요!'
      : '요즘 폼은 무난해요. 한 끗만 더 과감하게 해봅시다!'

  return {
    recentAverage: Math.round(recentAverage),
    baselineAverage: Math.round(baselineAverage),
    delta,
    message,
  }
}