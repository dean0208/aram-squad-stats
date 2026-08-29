export interface GameCommentaryResult {
  name: string
  contribution_score: number
  damage_dealt: number
  damage_taken: number
  healing: number
  assists: number
  cc_score: number
}

export interface GameCommentaryGame {
  our_team_win: boolean
  game_results: GameCommentaryResult[]
}

export function getGameCommentary(game: GameCommentaryGame): string {
  const results = game.game_results
  if (!results.length) return '다음 판엔 더 뜨겁게 가보자!'

  if (!game.our_team_win) {
    const least = [...results].sort((a, b) => a.contribution_score - b.contribution_score)[0]
    return `아니 ${least.name}님, 오늘은 좀 아쉬워요? 다음 판 반등 가시죠!`
  }

  const mvp = [...results].sort((a, b) => b.contribution_score - a.contribution_score)[0]
  const max = (key: keyof Pick<GameCommentaryResult, 'damage_dealt' | 'damage_taken' | 'healing' | 'assists' | 'cc_score'>) =>
    Math.max(...results.map(result => result[key]))
  const contributions = [
    { key: 'damage_dealt' as const, label: '폭딜' },
    { key: 'damage_taken' as const, label: '탱킹' },
    { key: 'healing' as const, label: '힐 지원' },
    { key: 'assists' as const, label: '연계 플레이' },
    { key: 'cc_score' as const, label: 'CC' },
  ]
  const best = contributions
    .map(contribution => ({
      ...contribution,
      value: max(contribution.key) > 0 ? mvp[contribution.key] / max(contribution.key) : 0,
    }))
    .sort((a, b) => b.value - a.value)[0]

  return best.value > 0
    ? `기가 막힌 ${mvp.name}님의 ${best.label}!`
    : `${mvp.name}님의 끈질긴 팀플레이 덕분에 이겼다!`
}
