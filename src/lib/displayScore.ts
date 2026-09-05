/**
 * 화면에 보여줄 0-100 점수.
 *
 * 예전 점수 모델은 팀 내 지분만 썼기 때문에 원점수가 9~49 범위에 몰렸고,
 * 이를 sqrt 로 늘려 표시했다. 현재 모델은 자체적으로 0-100 로 나오므로
 * 반올림만 한다. 저장된 점수를 재계산하기 전에는 옛 원점수가 그대로 보인다.
 */
export function toDisplayContributionScore(rawScore: number): number {
  if (!Number.isFinite(rawScore) || rawScore <= 0) return 0
  return Math.round(Math.min(100, rawScore))
}
