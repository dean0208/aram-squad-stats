export interface AugmentGame {
  our_team_win: boolean
  augment_ids: number[]
}

export interface AugmentHighlight {
  id: number
  games: number
  wins: number
}

export function getAugmentHighlight(games: AugmentGame[]): AugmentHighlight | null {
  const stats = new Map<number, { games: number; wins: number }>()

  for (const game of games) {
    const uniqueAugments = new Set(game.augment_ids)
    for (const id of uniqueAugments) {
      const current = stats.get(id) ?? { games: 0, wins: 0 }
      stats.set(id, {
        games: current.games + 1,
        wins: current.wins + (game.our_team_win ? 1 : 0),
      })
    }
  }

  const ranked = [...stats.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => {
      const impactA = a.wins - (a.games - a.wins)
      const impactB = b.wins - (b.games - b.wins)
      return impactB - impactA || b.wins - a.wins || b.games - a.games
    })

  return ranked[0] ?? null
}
