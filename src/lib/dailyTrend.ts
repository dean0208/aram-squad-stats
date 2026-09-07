/**
 * 하루의 상승·하락세를 고른다 — "임마 좀 치네"(캐리)와 "임마 걸배이고"(걸배이).
 *
 * 화면 하단 카드와 갱신 연출이 같은 사람을 가리켜야 해서, 판정을 여기 한 곳에
 * 둔다. 예전에는 카드 안에서 즉석으로 계산해 연출 쪽이 참조할 수가 없었다.
 *
 * 이 모듈은 의존성이 없다. 테스트가 `.mjs` 에서 `.ts` 를 직접 import 하므로
 * 확장자 없는 상대 import 를 쓰면 Node 의 ESM 리졸버가 찾지 못한다.
 */

export interface TrendResult {
  puuid: string
  /** 전체 평균 대비 오늘의 기여도 차이. 양수면 평소보다 잘한 것. */
  diff: number
  /** 오늘 평균 기여도 */
  todayAvg: number
  /** 전체 평균 기여도 */
  baseline: number
}

export interface DailyTrend {
  /** 평소 대비 가장 좋았던 사람 */
  carry: TrendResult
  /** 평소 대비 가장 나빴던 사람 */
  anchor: TrendResult
}

export interface TrendScore {
  puuid: string
  perfScore: number
}

/**
 * 전체 기록과 오늘 기록을 받아 캐리·걸배이를 고른다.
 *
 * 둘 다 나오려면 오늘 기록이 있는 플레이어가 최소 둘은 있어야 한다. 한 명뿐인
 * 날에 같은 사람을 캐리이자 걸배이로 세우면 카드가 우스워지므로 null 을 준다.
 */
export function computeDailyTrend(
  allScores: TrendScore[],
  todayScores: TrendScore[],
): DailyTrend | null {
  const baselineByPuuid = groupMean(allScores)
  const todayByPuuid = groupMean(todayScores)

  const results: TrendResult[] = []
  for (const [puuid, todayAvg] of todayByPuuid) {
    const baseline = baselineByPuuid.get(puuid)
    if (baseline === undefined) continue
    results.push({ puuid, diff: todayAvg - baseline, todayAvg, baseline })
  }

  if (results.length < 2) return null

  const sorted = [...results].sort((a, b) => b.diff - a.diff)
  return { carry: sorted[0], anchor: sorted[sorted.length - 1] }
}

function groupMean(scores: TrendScore[]): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>()
  for (const { puuid, perfScore } of scores) {
    const entry = sums.get(puuid) ?? { total: 0, count: 0 }
    entry.total += perfScore
    entry.count += 1
    sums.set(puuid, entry)
  }

  const means = new Map<string, number>()
  for (const [puuid, { total, count }] of sums) means.set(puuid, total / count)
  return means
}
