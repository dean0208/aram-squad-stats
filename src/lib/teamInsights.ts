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

  if (!types.has('Tank')) insights.push('우리 4인 픽에는 탱커로 분류된 챔피언이 없었어요.')
  if (!types.has('AD')) insights.push('우리 4인 픽에는 AD·물리 딜 역할이 없었어요.')
  if (!types.has('AP')) insights.push('우리 4인 픽에는 AP·마법 딜 역할이 없었어요.')
  if (damageDealers < 2) insights.push('우리 4인 픽에서 딜러로 분류된 챔피언은 2명 미만이었어요.')
  if (!insights.length) insights.push('우리 4인 픽에 AD·AP 딜과 탱커 역할이 모두 있었어요.')

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
  return getRoleByPlayer(games, 'best')
}

export function getWorstRoleByPlayer(games: RoleGame[]): Map<string, BestRole> {
  return getRoleByPlayer(games, 'worst')
}

function getRoleByPlayer(games: RoleGame[], direction: 'best' | 'worst'): Map<string, BestRole> {
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
    const eligibleRoles = [...roles.entries()].filter(([, value]) => value.games >= 10)
    if (!eligibleRoles.length) return [playerId, null] as const
    const best = eligibleRoles.sort((a, b) =>
      (direction === 'best' ? 1 : -1) * (b[1].wins / b[1].games - a[1].wins / a[1].games)
      || b[1].games - a[1].games
    )[0]
    const [role, value] = best
    return [playerId, { role, ...value, winRate: Math.round((value.wins / value.games) * 100) }]
  }).filter((entry): entry is [string, BestRole] => entry[1] !== null))
}
