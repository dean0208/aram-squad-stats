import type { GameResult, Game } from './types'

export interface Medal {
  id: string
  emoji: string
  name: string
  description: string
  field: keyof GameResult
  direction: 'highest' | 'lowest'
  shame?: boolean
}

export const MEDALS: Medal[] = [
  {
    id: 'mvp',
    emoji: '👑',
    name: 'MVP',
    description: '최고 기여도',
    field: 'contribution_score',
    direction: 'highest',
  },
  {
    id: 'dealer',
    emoji: '⚔️',
    name: '딜장인',
    description: '최고 딜량',
    field: 'damage_dealt',
    direction: 'highest',
  },
  {
    id: 'gold',
    emoji: '💰',
    name: '골드왕',
    description: '최다 골드',
    field: 'gold_earned',
    direction: 'highest',
  },
  {
    id: 'healer',
    emoji: '💊',
    name: '힐봇',
    description: '최고 힐량',
    field: 'healing',
    direction: 'highest',
  },
  {
    id: 'tank',
    emoji: '🛡️',
    name: '인간방패',
    description: '최고 피해흡수',
    field: 'damage_taken',
    direction: 'highest',
  },
  {
    id: 'killer',
    emoji: '🎯',
    name: '킬머신',
    description: '최다 킬',
    field: 'kills',
    direction: 'highest',
  },
  {
    id: 'assist',
    emoji: '🤝',
    name: '어시왕',
    description: '최다 어시스트',
    field: 'assists',
    direction: 'highest',
  },
  {
    id: 'death',
    emoji: '💀',
    name: '죽어줘',
    description: '최다 데스',
    field: 'deaths',
    direction: 'highest',
    shame: true,
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
      value: r[medal.field] as number,
    }))

    const target =
      medal.direction === 'highest'
        ? Math.max(...values.map((v) => v.value))
        : Math.min(...values.map((v) => v.value))

    // Skip if all values are identical (no meaningful winner)
    const allSame = values.every((v) => v.value === values[0].value)
    if (allSame) return []

    // For shame/lowest, skip if target is 0 and lowest direction (everyone could be 0)
    // But we already skip if allSame, so just skip if all are 0
    if (target === 0 && medal.direction === 'lowest') return []

    const winners = values.filter((v) => v.value === target).map((v) => v.result)
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
