import Link from 'next/link'
import Image from 'next/image'
import { createServerClient } from '@/lib/supabase'
import { TRACKED_PLAYERS, DDRAGON_VERSION } from '@/lib/config'
import SyncButton from '@/components/SyncButton'
import type { Game, GameResult } from '@/lib/types'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function ChampionIcon({
  name,
  size = 32,
}: {
  name: string
  size?: number
}) {
  // DDragon uses specific name transformations for some champions
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <Image
      src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${safeName}.png`}
      alt={name}
      width={size}
      height={size}
      className="rounded"
      unoptimized
    />
  )
}

async function getStats() {
  const supabase = createServerClient()

  const { data: games } = await supabase
    .from('games')
    .select(
      `
      id,
      match_id,
      played_at,
      duration_seconds,
      our_team_win,
      our_team_id,
      game_results (
        id,
        champion_name,
        champion_id,
        kills,
        deaths,
        assists,
        damage_dealt,
        perf_score,
        contribution_score,
        players (
          id,
          puuid,
          game_name,
          tag_line
        )
      )
    `,
    )
    .order('played_at', { ascending: false })
    .limit(10)

  return (games ?? []) as unknown as Game[]
}

async function getPlayerSummaries() {
  const supabase = createServerClient()
  const { data: players } = await supabase
    .from('players')
    .select('id, puuid, game_name, tag_line')

  if (!players?.length) return []

  const summaries = await Promise.all(
    players.map(async (player) => {
      const { data: results } = await supabase
        .from('game_results')
        .select(
          `
          champion_name,
          perf_score,
          contribution_score,
          games (
            our_team_win
          )
        `,
        )
        .eq('player_id', player.id)

      const total = results?.length ?? 0
      const wins = results?.filter(
        (r) => (r.games as unknown as { our_team_win: boolean } | null)?.our_team_win,
      ).length ?? 0
      const avgContrib =
        total > 0
          ? Math.round(
              ((results?.reduce((a, r) => a + (r.contribution_score ?? 0), 0) ?? 0) / total) * 10,
            ) / 10
          : 0

      // Find best champion by games played
      const champCounts = new Map<string, number>()
      for (const r of results ?? []) {
        champCounts.set(r.champion_name, (champCounts.get(r.champion_name) ?? 0) + 1)
      }
      const bestChamp =
        [...champCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

      return {
        ...player,
        total,
        wins,
        win_rate: total > 0 ? Math.round((wins / total) * 100) : 0,
        avg_contribution: avgContrib,
        best_champion: bestChamp,
      }
    }),
  )

  // Sort by configured player order
  return summaries.sort((a, b) => {
    const ai = TRACKED_PLAYERS.findIndex((p) => p.puuid === a.puuid)
    const bi = TRACKED_PLAYERS.findIndex((p) => p.puuid === b.puuid)
    return ai - bi
  })
}

export default async function HomePage() {
  const [games, playerSummaries] = await Promise.all([getStats(), getPlayerSummaries()])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">ARAM Squad Stats</h1>
          <p className="text-gray-400 mt-1">OCE server • 4-stack ARAM tracker</p>
        </div>
        <SyncButton />
      </div>

      {/* Player Cards */}
      <section>
        <h2 className="text-xl font-semibold text-gray-300 mb-4">Players</h2>
        {playerSummaries.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No data yet — click &quot;Sync Games&quot; to pull match history
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {playerSummaries.map((player) => (
              <Link
                key={player.puuid}
                href={`/players/${encodeURIComponent(player.puuid)}`}
                className="block bg-gray-800 rounded-xl p-5 hover:bg-gray-750 hover:border-purple-600 border border-gray-700 transition-all"
              >
                <div className="font-semibold text-white text-lg">
                  {player.game_name}
                </div>
                <div className="text-sm text-gray-400 mb-3">#{player.tag_line}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Games</span>
                    <span className="text-white font-medium">{player.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Win Rate</span>
                    <span
                      className={
                        player.win_rate >= 50 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'
                      }
                    >
                      {player.win_rate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Contribution</span>
                    <span className="text-purple-400 font-medium">{player.avg_contribution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Most Played</span>
                    <span className="text-yellow-400 font-medium">{player.best_champion}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Games */}
      <section>
        <h2 className="text-xl font-semibold text-gray-300 mb-4">Recent Games</h2>
        {games.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No games recorded yet
          </p>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/games/${game.id}`}
                className="block bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-purple-600 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        game.our_team_win
                          ? 'bg-green-900 text-green-300'
                          : 'bg-red-900 text-red-300'
                      }`}
                    >
                      {game.our_team_win ? 'WIN' : 'LOSS'}
                    </span>
                    <span className="text-gray-400 text-sm">{formatDate(game.played_at)}</span>
                    <span className="text-gray-500 text-sm">{formatDuration(game.duration_seconds)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  {game.game_results
                    .filter((r: GameResult) => r.players)
                    .sort((a: GameResult, b: GameResult) => b.contribution_score - a.contribution_score)
                    .map((result: GameResult) => (
                      <div key={result.id} className="flex items-center gap-2">
                        <ChampionIcon name={result.champion_name} size={28} />
                        <div>
                          <div className="text-xs text-gray-300">
                            {result.players?.game_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {result.champion_name} • {result.kills}/{result.deaths}/{result.assists}
                          </div>
                        </div>
                        <div className="ml-1 text-xs font-bold text-purple-400">
                          {result.contribution_score}
                        </div>
                      </div>
                    ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
