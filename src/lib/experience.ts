import type { Game, GameResult } from './types'

export function kstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600000)
    .toISOString()
    .slice(0, 10)
}

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const date = new Date(`${value}T00:00:00Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

export function displayDate(iso: string, withTime = false) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    ...(withTime
      ? ({ hour: '2-digit', minute: '2-digit' } as const)
      : ({ weekday: 'short' } as const)),
  }).format(new Date(iso.length === 10 ? `${iso}T00:00:00+09:00` : iso))
}

export function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function gameHref(
  game: Pick<Game, 'id' | 'played_at'>,
  date = kstDate(game.played_at),
) {
  return `/games/${encodeURIComponent(game.id)}?date=${date}`
}

export function homeHref(date?: string, gameId?: string) {
  const params = new URLSearchParams()
  if (validDate(date)) params.set('date', date)
  if (gameId) params.set('game', gameId)
  return `/${params.size ? `?${params}` : ''}${gameId ? `#match-${encodeURIComponent(gameId)}` : ''}`
}

export type RecordPeriod = 'week' | 'month' | 'all'
export function periodGames(games: Game[], date: string, period: RecordPeriod) {
  if (period === 'all') return games
  const start = new Date(`${date}T00:00:00Z`)
  if (period === 'month') start.setUTCDate(1)
  else start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  const first = start.toISOString().slice(0, 10)
  return games.filter((game) => {
    const day = kstDate(game.played_at)
    return day >= first && day <= date
  })
}

export const CONTESTS = [
  {
    id: 'score',
    label: '더킹갓제네럴',
    emoji: '👑',
    field: 'perf_score',
    unit: '점',
    average: true,
  },
  {
    id: 'assist',
    label: '님 hoxy 케리아?',
    emoji: '🤝',
    field: 'assists',
    unit: '어시',
    average: false,
  },
  {
    id: 'damage',
    label: '손꾸락 안아프나?',
    emoji: '⚔️',
    field: 'damage_dealt',
    unit: '딜',
    average: false,
  },
  {
    id: 'tank',
    label: '쳐맞는게 즐거워요',
    emoji: '🛡️',
    field: 'damage_taken',
    unit: '피해흡수',
    average: false,
  },
  {
    id: 'healing',
    label: '니마 힐 좀',
    emoji: '💊',
    field: 'healing',
    unit: '회복',
    average: false,
  },
  {
    id: 'cc',
    label: '꼼짝마!',
    emoji: '🌀',
    field: 'cc_score',
    unit: 'CC',
    average: false,
  },
] as const

export function contestStandings(
  games: Game[],
  contest: (typeof CONTESTS)[number],
) {
  const map = new Map<
    string,
    { puuid: string; name: string; total: number; count: number }
  >()
  for (const game of games)
    for (const result of game.game_results) {
      if (!result.players) continue
      const { puuid, game_name } = result.players
      const entry = map.get(puuid) ?? {
        puuid,
        name: game_name,
        total: 0,
        count: 0,
      }
      entry.total += result[contest.field]
      entry.count++
      map.set(puuid, entry)
    }
  return [...map.values()]
    .map((entry) => ({
      ...entry,
      value: contest.average ? entry.total / entry.count : entry.total,
    }))
    .sort((a, b) => b.value - a.value || a.puuid.localeCompare(b.puuid))
}

export interface RecordMoment {
  id: string
  puuid: string
  name: string
  label: string
  value: number
  previous: number
  game: Game
  previousGame: Game
}

/** Record-breaking events are compared only with earlier matches, never future results. */
export function recordMoments(games: Game[], date: string): RecordMoment[] {
  const history = new Map<string, { result: GameResult; game: Game }[]>()
  const moments: RecordMoment[] = []
  for (const game of [...games].sort((a, b) =>
    a.played_at.localeCompare(b.played_at),
  )) {
    for (const result of game.game_results) {
      if (!result.players) continue
      const { puuid, game_name: name } = result.players
      const earlier = history.get(puuid) ?? []
      if (kstDate(game.played_at) === date && earlier.length >= 3) {
        for (const [field, label] of [
          ['perf_score', '개인 최고점 경신'],
          ['assists', '최다 어시 경신'],
        ] as const) {
          const best = earlier.reduce((a, b) =>
            a.result[field] >= b.result[field] ? a : b,
          )
          if (result[field] > best.result[field])
            moments.push({
              id: `${game.id}-${puuid}-${field}`,
              puuid,
              name,
              label,
              value: result[field],
              previous: best.result[field],
              game,
              previousGame: best.game,
            })
        }
        const last = earlier[earlier.length - 1]
        if (
          last.result.perf_score < 50 &&
          result.perf_score - last.result.perf_score >= 15
        )
          moments.push({
            id: `${game.id}-${puuid}-bounce`,
            puuid,
            name,
            label: '반등 성공',
            value: result.perf_score,
            previous: last.result.perf_score,
            game,
            previousGame: last.game,
          })
      }
      earlier.push({ result, game })
      history.set(puuid, earlier)
    }
  }
  return moments.reverse()
}

export function sessionSummary(games: Game[]) {
  const sorted = [...games].sort((a, b) =>
    b.played_at.localeCompare(a.played_at),
  )
  const wins = games.filter((game) => game.our_team_win).length
  const losses = games.length - wins
  const seconds = games.reduce((sum, game) => sum + game.duration_seconds, 0)
  const line = !games.length
    ? '아직 조용한 나락'
    : wins === games.length
      ? '오늘 우리 좀 치네.'
      : sorted[0].our_team_win && sorted[1] && !sorted[1].our_team_win
        ? '마지막 판은 챙겼다.'
        : losses > wins
          ? '전적은 남고, 다음 판은 온다.'
          : '이 맛에 같이 하지.'
  return { wins, losses, seconds, line }
}
