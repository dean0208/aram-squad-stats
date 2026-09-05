import type { GameResult, Game } from './types'

export interface Medal {
  id: string
  emoji: string
  name: string
  description: string
  field: keyof GameResult
  direction: 'highest' | 'lowest'
  shame?: boolean
  /** 항상 발급하는 대표 메달. 격차 기준을 적용하지 않는다. */
  alwaysAward?: boolean
  /**
   * 나머지 참가자 평균 대비 이 배수만큼 앞서야 발급한다.
   * 스탯별 자연 분산이 크게 달라서(골드는 고르고 힐량은 편중) 값을 따로 잡는다.
   * 누적 경기 표본에서 발급률이 대략 절반이 되는 지점으로 맞췄다.
   */
  dominance?: number
}

/** 별도 지정이 없는 메달의 기준 배수. */
export const MEDAL_DOMINANCE = 1.25

export const MEDALS: Medal[] = [
  {
    id: 'mvp',
    emoji: '👑',
    name: 'MVP',
    description: '최고 기여도',
    field: 'contribution_score',
    direction: 'highest',
    alwaysAward: true,
  },
  {
    id: 'dealer',
    emoji: '⚔️',
    name: '딜장인',
    description: '최고 딜량',
    field: 'damage_dealt',
    direction: 'highest',
    dominance: 1.75,
  },
  {
    id: 'gold',
    emoji: '💰',
    name: '골드왕',
    description: '최다 골드',
    field: 'gold_earned',
    direction: 'highest',
    dominance: 1.1,
  },
  {
    id: 'healer',
    emoji: '💊',
    name: '힐봇',
    description: '최고 힐량',
    field: 'healing',
    direction: 'highest',
    dominance: 3,
  },
  {
    id: 'tank',
    emoji: '🛡️',
    name: '인간방패',
    description: '최고 피해흡수',
    field: 'damage_taken',
    direction: 'highest',
    dominance: 1.75,
  },
  {
    id: 'killer',
    emoji: '🎯',
    name: '킬머신',
    description: '최다 킬',
    field: 'kills',
    direction: 'highest',
    dominance: 2,
  },
  {
    id: 'assist',
    emoji: '🤝',
    name: '어시왕',
    description: '최다 어시스트',
    field: 'assists',
    direction: 'highest',
    dominance: 1.4,
  },
  {
    id: 'death',
    emoji: '💀',
    name: '죽어줘',
    description: '최다 데스',
    field: 'deaths',
    direction: 'highest',
    shame: true,
    dominance: 1.3,
  },
  {
    id: 'passive',
    emoji: '🐔',
    name: '꽁꽁이',
    description: '최저 CC 기여',
    field: 'cc_score',
    direction: 'lowest',
    shame: true,
  },
]

export interface MedalWinner {
  medal: Medal
  winners: GameResult[]
}

export function calculateMedals(results: GameResult[]): MedalWinner[] {
  const validResults = results.filter((r) => r.players !== null)
  if (validResults.length < 2) return []

  return MEDALS.flatMap((medal) => {
    const values = validResults.map((r) => ({
      result: r,
      value: (r[medal.field] as number) ?? 0,
    }))

    const target =
      medal.direction === 'highest'
        ? Math.max(...values.map((v) => v.value))
        : Math.min(...values.map((v) => v.value))

    // 전원이 같은 값이면 의미 있는 수상자가 없다.
    // (전원 0 인 경우도 여기서 걸러진다)
    const allSame = values.every((v) => v.value === values[0].value)
    if (allSame) return []

    const winners = values.filter((v) => v.value === target).map((v) => v.result)

    if (!medal.alwaysAward) {
      const others = values.filter((v) => v.value !== target)
      const othersAverage = others.reduce((sum, v) => sum + v.value, 0) / Math.max(1, others.length)
      const dominance = medal.dominance ?? MEDAL_DOMINANCE
      const dominant =
        medal.direction === 'highest'
          ? othersAverage > 0
            ? target >= othersAverage * dominance
            : target > 0
          : othersAverage > 0 && target <= othersAverage / dominance
      if (!dominant) return []
    }

    return [{ medal, winners }]
  })
}

// Returns: playerName -> medalId -> count (only sole winners, not ties)
export function calculateAllTimeBadges(
  games: Game[],
): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = {}

  for (const game of games) {
    const medals = calculateMedals(game.game_results)
    for (const { medal, winners } of medals) {
      // Only count if single winner (skip ties)
      if (winners.length === 1 && winners[0].players) {
        const playerName = winners[0].players.game_name
        if (!counts[playerName]) counts[playerName] = {}
        counts[playerName][medal.id] = (counts[playerName][medal.id] ?? 0) + 1
      }
    }
  }

  return counts
}
