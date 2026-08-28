export interface MvpScoredResult {
  perf_score: number
}

export function selectMvp<T extends MvpScoredResult>(results: T[]): T | null {
  if (results.length === 0) return null

  return results.reduce((mvp, result) =>
    result.perf_score > mvp.perf_score ? result : mvp,
  )
}
