export type DamageType = 'AD' | 'AP' | 'Tank' | 'Utility'

export interface CompositionMember {
  championName: string
  damageType: DamageType
}

export interface CompositionGame {
  win: boolean
  members: CompositionMember[]
}

export interface ChampionCompositionGame {
  win: boolean
  members: { playerId: string; championName: string }[]
}

export interface RoleGame {
  win: boolean
  members: { playerId: string; role: string }[]
}

export interface BestChampionComposition {
  champions: string[]
  wins: number
  games: number
  winRate: number
}

export interface BestRole {
  role: string
  wins: number
  games: number
  winRate: number
}

export function analyzeTeamComposition(game: CompositionGame): string[] {
  const types = new Set(game.members.map(member => member.damageType))
  const insights: string[] = []
  const damageDealers = game.members.filter(member => member.damageType === 'AD' || member.damageType === 'AP').length

  if (!types.has('Tank')) insights.push('앞에서 받아줄 탱커가 부족해서 한타를 열고 버티기 어려운 조합이었어요.')
  if (!types.has('AD')) insights.push('AD·물리 딜이 부족해서 상대가 방어 아이템 하나로 버티기 쉬운 조합이었어요.')
  if (!types.has('AP')) insights.push('AP·마법 딜이 부족해서 상대가 방어력을 한쪽으로만 올리기 쉬운 조합이었어요.')
  if (damageDealers < 2) insights.push('실질적인 딜러가 부족해서 앞라인을 녹이는 속도가 느렸어요.')
  if (!insights.length) insights.push('AD·AP 딜과 앞라인이 균형 잡힌 조합이었어요.')

  return insights.slice(0, 2)
}

export function getBestChampionComposition(games: ChampionCompositionGame[]): BestChampionComposition | null {
  const stats = new Map<string, { champions: string[]; wins: number; games: number }>()
  for (const game of games) {
    if (!game.members.length) continue
    const champions = game.members.map(member => member.championName).sort()
    const key = champions.join('|')
    const current = stats.get(key) ?? { champions, wins: 0, games: 0 }
    current.games++
    if (game.win) current.wins++
    stats.set(key, current)
  }
  const ranked = [...stats.values()].filter(stat => stat.games >= 3).sort((a, b) => {
    const rateDiff = b.wins / b.games - a.wins / a.games
    return rateDiff || b.games - a.games || a.champions.join('|').localeCompare(b.champions.join('|'))
  })
  const best = ranked[0]
  return best ? { ...best, winRate: Math.round((best.wins / best.games) * 100) } : null
}

export function getBestRoleByPlayer(games: RoleGame[]): Map<string, BestRole> {
  const stats = new Map<string, Map<string, { wins: number; games: number }>>()
  for (const game of games) {
    for (const member of game.members) {
      const playerStats = stats.get(member.playerId) ?? new Map()
      const current = playerStats.get(member.role) ?? { wins: 0, games: 0 }
      current.games++
      if (game.win) current.wins++
      playerStats.set(member.role, current)
      stats.set(member.playerId, playerStats)
    }
  }

  return new Map([...stats.entries()].map(([playerId, roles]) => {
    const best = [...roles.entries()].sort((a, b) =>
      b[1].wins / b[1].games - a[1].wins / a[1].games || b[1].games - a[1].games
    )[0]
    const [role, value] = best
    return [playerId, { role, ...value, winRate: Math.round((value.wins / value.games) * 100) }]
  }))
}
