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
  game_id?: string | number
  our_team_win: boolean
  game_results: GameCommentaryResult[]
}

type ContributionKey = 'damage_dealt' | 'damage_taken' | 'healing' | 'assists' | 'cc_score'

function pickVariant<T>(items: T[], seed: string): T {
  const hash = [...seed].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 7)
  return items[hash % items.length]
}

export function getGameCommentary(game: GameCommentaryGame): string {
  const results = game.game_results
  if (!results.length) return '다음 판엔 더 뜨겁게 가보자!'

  const seed = String(game.game_id ?? results.map(result => result.name).join('|'))

  if (!game.our_team_win) {
    const least = [...results].sort((a, b) => a.contribution_score - b.contribution_score)[0]
    const best = [...results].sort((a, b) => b.contribution_score - a.contribution_score)[0]
    const gap = best.contribution_score - least.contribution_score
    const lossLines = gap >= 25
      ? [
          `${best.name}님은 분전했는데 ${least.name}님 쪽에서 조금 아쉬웠어요. 다음 판 반등 가시죠!`,
          `${best.name}님 고군분투는 빛났지만, ${least.name}님 오늘은 좀 아쉬워요?`,
          `${least.name}님, 오늘은 좀 아쉬워요. ${best.name}님 분전 이어서 다음 판 갑시다!`,
        ]
      : [
          `${least.name}님, 오늘은 살짝 아쉬워요. 한 끗 차이였으니 다음 판 가시죠!`,
          `다 같이 아쉬운 한 판이었네요. 특히 ${least.name}님, 다음 판 반등 갑시다!`,
          `${least.name}님 오늘은 좀 꼬였네요. 다음 판엔 다시 뜨겁게 가시죠!`,
        ]
    return pickVariant(lossLines, seed)
  }

  const mvp = [...results].sort((a, b) => b.contribution_score - a.contribution_score)[0]
  const max = (key: keyof Pick<GameCommentaryResult, 'damage_dealt' | 'damage_taken' | 'healing' | 'assists' | 'cc_score'>) =>
    Math.max(...results.map(result => result[key]))
  const contributions: { key: ContributionKey; label: string }[] = [
    { key: 'damage_dealt', label: '폭딜' },
    { key: 'damage_taken', label: '탱킹' },
    { key: 'healing', label: '힐 지원' },
    { key: 'assists', label: '연계 플레이' },
    { key: 'cc_score', label: 'CC' },
  ]
  const best = contributions
    .map(contribution => ({
      ...contribution,
      value: max(contribution.key) > 0 ? mvp[contribution.key] / max(contribution.key) : 0,
    }))
    .sort((a, b) => b.value - a.value)[0]

  if (best.value <= 0) {
    return pickVariant([
      `${mvp.name}님의 끈질긴 팀플레이 덕분에 이겼다!`,
      `${mvp.name}님 중심으로 끝까지 뭉친 게 승리의 열쇠였네요!`,
      `누구 하나 빠지지 않고 버틴 덕분에 ${mvp.name}님이 마무리했어요!`,
    ], seed)
  }

  const lines: Record<ContributionKey, string[]> = {
    damage_dealt: [
      `${mvp.name}님이 앞라인 녹이고 딜로 게임을 열었네요!`,
      `${mvp.name}님 포킹과 폭딜이 제대로 들어간 판입니다!`,
      `상대 체력바를 지운 건 ${mvp.name}님의 화력이었어요!`,
    ],
    damage_taken: [
      `${mvp.name}님 탱킹으로 앞에서 다 받아주니 우리 딜러들이 편했네요!`,
      `${mvp.name}님 탱킹으로 단단하게 버틴 덕분에 한타가 길어질수록 유리했어요!`,
      `이번 판 숨은 공신은 ${mvp.name}님 탱킹입니다. 맞을 건 다 맞았네요!`,
    ],
    healing: [
      `${mvp.name}님 힐 지원 덕분에 죽을 타이밍마다 살아났네요!`,
      `${mvp.name}님이 체력 복구를 책임져서 한타 유지력이 좋았어요!`,
      `우리 팀 생명줄은 ${mvp.name}님이었네요. 힐 지원 제대로였습니다!`,
    ],
    assists: [
      `${mvp.name}님이 계속 합을 맞춰줘서 팀 싸움이 매끄러웠어요!`,
      `${mvp.name}님 연계 플레이 덕분에 킬각이 계속 나왔네요!`,
      `혼자 캐리라기보다 ${mvp.name}님이 팀을 잘 굴린 승리입니다!`,
    ],
    cc_score: [
      `${mvp.name}님 CC 한 번에 한타 흐름이 확 바뀌었네요!`,
      `${mvp.name}님이 상대 발을 묶어줘서 딜 넣기 편한 판이었어요!`,
      `상대가 아무것도 못 하게 만든 건 ${mvp.name}님의 CC였습니다!`,
    ],
  }

  return pickVariant(lines[best.key], seed)
}
