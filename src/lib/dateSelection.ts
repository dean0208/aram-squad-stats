export interface DatedGame {
  played_at: string
}

export function toKSTDateString(iso: string): string | null {
  const timestamp = new Date(iso).getTime()
  if (!Number.isFinite(timestamp)) return null
  return new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function getLatestGameDate(games: DatedGame[], fallback = ''): string {
  const dates = games
    .map(game => toKSTDateString(game.played_at))
    .filter((date): date is string => date !== null)
    .sort()
  return dates[dates.length - 1] ?? fallback
}
