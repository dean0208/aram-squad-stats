import type { Game, GameResult } from './types'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlayerStats {
  playerName: string
  puuid: string
  gamesPlayed: number
  totalKills: number
  totalDeaths: number
  totalAssists: number
  totalDamageDealt: number
  totalDamageTaken: number
  totalHealing: number
  totalGoldEarned: number
  totalCcScore: number
  avgContribution: number
  avgContributionOnLoss: number
  lossGames: number
  currentWinStreak: number
  currentLossStreak: number
}

export interface NicknameAward {
  id: string
  emoji: string
  name: string
  description: string
  color: string        // tailwind gradient from-/to-
  borderColor: string
  textColor: string
  winner: string       // game_name
  winnerPuuid: string
  valueLabel: string   // formatted value e.g. "총 342회 죽음"
}

// ─── Color themes ─────────────────────────────────────────────────────────────

const COLORS: Record<string, { color: string; borderColor: string; textColor: string }> = {
  red:    { color: 'from-red-950 to-red-900',       borderColor: 'border-red-700',    textColor: 'text-red-300' },
  orange: { color: 'from-orange-950 to-orange-900', borderColor: 'border-orange-700', textColor: 'text-orange-300' },
  amber:  { color: 'from-amber-950 to-amber-900',   borderColor: 'border-amber-700',  textColor: 'text-amber-300' },
  yellow: { color: 'from-yellow-950 to-yellow-900', borderColor: 'border-yellow-700', textColor: 'text-yellow-300' },
  green:  { color: 'from-green-950 to-green-900',   borderColor: 'border-green-700',  textColor: 'text-green-300' },
  blue:   { color: 'from-blue-950 to-blue-900',     borderColor: 'border-blue-700',   textColor: 'text-blue-300' },
  indigo: { color: 'from-indigo-950 to-indigo-900', borderColor: 'border-indigo-700', textColor: 'text-indigo-300' },
  purple: { color: 'from-purple-950 to-purple-900', borderColor: 'border-purple-700', textColor: 'text-purple-300' },
  pink:   { color: 'from-pink-950 to-pink-900',     borderColor: 'border-pink-700',   textColor: 'text-pink-300' },
  rose:   { color: 'from-rose-950 to-rose-900',     borderColor: 'border-rose-700',   textColor: 'text-rose-300' },
  cyan:   { color: 'from-cyan-950 to-cyan-900',     borderColor: 'border-cyan-700',   textColor: 'text-cyan-300' },
  slate:  { color: 'from-slate-800 to-slate-700',   borderColor: 'border-slate-600',  textColor: 'text-slate-300' },
}

// ─── Nickname definitions ────────────────────────────────────────────────────

interface NicknameDefinition {
  id: string
  emoji: string
  name: string
  description: string
  colorKey: string
  getValue: (s: PlayerStats) => number
  formatValue: (s: PlayerStats) => string
  direction: 'highest' | 'lowest'
  minGames?: number  // skip if player has fewer games
}

const NICKNAME_DEFS: NicknameDefinition[] = [
  {
    id: 'legend',
    emoji: '👑',
    name: '전설',
    description: '누적 기여도 평균 1위 · 종합 MVP',
    colorKey: 'amber',
    getValue: (s) => s.avgContribution,
    formatValue: (s) => `평균 ${s.avgContribution.toFixed(1)}점`,
    direction: 'highest',
  },
  {
    id: 'destroyer',
    emoji: '💥',
    name: '파괴신',
    description: '누적 딜량 1위',
    colorKey: 'orange',
    getValue: (s) => s.totalDamageDealt,
    formatValue: (s) => `총 ${(s.totalDamageDealt / 1000).toFixed(0)}k 딜`,
    direction: 'highest',
  },
  {
    id: 'slayer',
    emoji: '⚔️',
    name: '학살자',
    description: '누적 킬 1위',
    colorKey: 'red',
    getValue: (s) => s.totalKills,
    formatValue: (s) => `총 ${s.totalKills}킬`,
    direction: 'highest',
  },
  {
    id: 'savior',
    emoji: '🩹',
    name: '생명의 은인',
    description: '누적 힐량 1위',
    colorKey: 'green',
    getValue: (s) => s.totalHealing,
    formatValue: (s) => `총 ${(s.totalHealing / 1000).toFixed(0)}k 힐`,
    direction: 'highest',
  },
  {
    id: 'wall',
    emoji: '🛡️',
    name: '살아있는 벽',
    description: '누적 피해흡수 1위',
    colorKey: 'blue',
    getValue: (s) => s.totalDamageTaken,
    formatValue: (s) => `총 ${(s.totalDamageTaken / 1000).toFixed(0)}k 흡수`,
    direction: 'highest',
  },
  {
    id: 'heart',
    emoji: '🤝',
    name: '팀의 심장',
    description: '누적 어시스트 1위',
    colorKey: 'pink',
    getValue: (s) => s.totalAssists,
    formatValue: (s) => `총 ${s.totalAssists}어시스트`,
    direction: 'highest',
  },
  {
    id: 'goldhands',
    emoji: '💰',
    name: '황금손',
    description: '누적 골드 획득 1위',
    colorKey: 'yellow',
    getValue: (s) => s.totalGoldEarned,
    formatValue: (s) => `총 ${(s.totalGoldEarned / 1000).toFixed(0)}k 골드`,
    direction: 'highest',
  },
  {
    id: 'ccmaster',
    emoji: '🌀',
    name: 'CC 달인',
    description: '누적 CC 기여 1위',
    colorKey: 'purple',
    getValue: (s) => s.totalCcScore,
    formatValue: (s) => `총 ${s.totalCcScore.toFixed(0)}점 CC`,
    direction: 'highest',
  },
  {
    id: 'bomb',
    emoji: '💀',
    name: '인간 폭탄',
    description: '누적 데스 1위',
    colorKey: 'rose',
    getValue: (s) => s.totalDeaths,
    formatValue: (s) => `총 ${s.totalDeaths}회 사망`,
    direction: 'highest',
  },
  {
    id: 'hotstreak',
    emoji: '🔥',
    name: '연승러',
    description: '현재 연승 기록 최다',
    colorKey: 'orange',
    getValue: (s) => s.currentWinStreak,
    formatValue: (s) => `현재 ${s.currentWinStreak}연승 중`,
    direction: 'highest',
    minGames: 1,
  },
  {
    id: 'coldstreak',
    emoji: '🧊',
    name: '연패러',
    description: '현재 연패 기록 최다',
    colorKey: 'cyan',
    getValue: (s) => s.currentLossStreak,
    formatValue: (s) => `현재 ${s.currentLossStreak}연패 중`,
    direction: 'highest',
    minGames: 1,
  },
]

// ─── Stat aggregation ────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

export { formatNum }

export function aggregatePlayerStats(games: Game[]): PlayerStats[] {
  // We need games sorted by date desc for streak computation
  const sortedGames = [...games].sort(
    (a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime(),
  )

  // Build a map: playerName -> per-game results (sorted newest first)
  const playerGameMap = new Map<
    string,
    { result: GameResult; win: boolean; puuid: string }[]
  >()

  for (const game of sortedGames) {
    const win = game.our_team_win
    for (const result of game.game_results) {
      if (!result.players) continue
      const name = result.players.game_name
      if (!playerGameMap.has(name)) playerGameMap.set(name, [])
      playerGameMap.get(name)!.push({ result, win, puuid: result.players.puuid })
    }
  }

  const statsArr: PlayerStats[] = []

  for (const [playerName, entries] of playerGameMap.entries()) {
    const puuid = entries[0].puuid

    let totalKills = 0
    let totalDeaths = 0
    let totalAssists = 0
    let totalDamageDealt = 0
    let totalDamageTaken = 0
    let totalHealing = 0
    let totalGoldEarned = 0
    let totalCcScore = 0
    let totalContribution = 0
    let lossContribSum = 0
    let lossGames = 0

    for (const { result, win } of entries) {
      totalKills += result.kills
      totalDeaths += result.deaths
      totalAssists += result.assists
      totalDamageDealt += result.damage_dealt
      totalDamageTaken += result.damage_taken
      totalHealing += result.healing
      totalGoldEarned += result.gold_earned
      totalCcScore += result.cc_score
      totalContribution += result.contribution_score
      if (!win) {
        lossContribSum += result.contribution_score
        lossGames++
      }
    }

    const gamesPlayed = entries.length
    const avgContribution = gamesPlayed > 0 ? totalContribution / gamesPlayed : 0
    const avgContributionOnLoss = lossGames > 0 ? lossContribSum / lossGames : 0

    // Compute streaks (entries are sorted newest first)
    let currentWinStreak = 0
    let currentLossStreak = 0
    // Count from most recent
    for (const { win } of entries) {
      if (win) {
        if (currentLossStreak > 0) break
        currentWinStreak++
      } else {
        if (currentWinStreak > 0) break
        currentLossStreak++
      }
    }

    statsArr.push({
      playerName,
      puuid,
      gamesPlayed,
      totalKills,
      totalDeaths,
      totalAssists,
      totalDamageDealt,
      totalDamageTaken,
      totalHealing,
      totalGoldEarned,
      totalCcScore,
      avgContribution,
      avgContributionOnLoss,
      lossGames,
      currentWinStreak,
      currentLossStreak,
    })
  }

  return statsArr
}

// ─── Nickname award computation ───────────────────────────────────────────────

export function computeNicknames(games: Game[]): NicknameAward[] {
  const stats = aggregatePlayerStats(games)
  if (stats.length < 2) return []

  const awards: NicknameAward[] = []

  for (const def of NICKNAME_DEFS) {
    const eligible = stats.filter(
      (s) => s.gamesPlayed >= (def.minGames ?? 1),
    )
    if (eligible.length < 2) continue

    const values = eligible.map((s) => def.getValue(s))
    const target =
      def.direction === 'highest' ? Math.max(...values) : Math.min(...values)

    // Skip trivial values
    if (target === 0) continue

    // Skip ties
    const winners = eligible.filter((s) => def.getValue(s) === target)
    if (winners.length !== 1) continue

    const winner = winners[0]
    const c = COLORS[def.colorKey]

    awards.push({
      id: def.id,
      emoji: def.emoji,
      name: def.name,
      description: def.description,
      color: c.color,
      borderColor: c.borderColor,
      textColor: c.textColor,
      winner: winner.playerName,
      winnerPuuid: winner.puuid,
      valueLabel: def.formatValue(winner),
    })
  }

  return awards
}

// ─── Game-level (per-game) awards ─────────────────────────────────────────────

export { MEDALS, calculateMedals } from './medals'
export type { MedalWinner } from './medals'
