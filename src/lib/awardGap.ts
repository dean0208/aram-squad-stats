/**
 * 2위와의 격차 계산.
 *
 * 4명이 항상 같은 수의 경기를 뛰기 때문에 누적 총량은 잘 수렴한다.
 * 실측에서는 어시스트 1위 격차가 1.1% 에 불과했는데도 "1위" 로만 보여
 * 타이틀이 실제보다 과대평가됐다.
 */

/** 2위와 이 비율 미만으로 벌어졌으면 접전으로 본다. */
export const CONTESTED_GAP_RATIO = 0.05

export interface AwardGap {
  gapRatio: number | null
  contested: boolean
  gapLabel: string | null
}

export function computeAwardGap(
  target: number,
  values: number[],
  direction: 'highest' | 'lowest',
): AwardGap {
  const runnerUp = values
    .filter(value => value !== target)
    .sort((a, b) => (direction === 'highest' ? b - a : a - b))[0]

  if (runnerUp === undefined || runnerUp === 0) {
    return { gapRatio: null, contested: false, gapLabel: null }
  }

  const gapRatio = Math.abs(target - runnerUp) / Math.abs(runnerUp)
  return {
    gapRatio,
    contested: gapRatio < CONTESTED_GAP_RATIO,
    gapLabel: `2위와 ${(gapRatio * 100).toFixed(1)}% 차`,
  }
}
