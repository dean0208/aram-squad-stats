import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createServerClient } from '@/lib/supabase'
import { DDRAGON_VERSION, getPlayerDisplayName } from '@/lib/config'
import { toDisplayContributionScore } from '@/lib/displayScore'
import type { ChampionReport, Game } from '@/lib/types'
import { computeNicknames } from '@/lib/nicknames'
import type { NicknameAward } from '@/lib/nicknames'

function ChampionIcon({ name, size = 32 }: { name: string; size?: number }) {
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

export default async function PlayerReportPage({
  params,
}: {
  params: Promise<{ puuid: string }>
}) {
  const { puuid } = await params
  const decodedPuuid = decodeURIComponent(puuid)

  const supabase = createServerClient()

  // Get player
  const { data: player } = await supabase
    .from('players')
    .select('id, puuid, game_name, tag_line')
    .eq('puuid', decodedPuuid)
    .single()

  if (!player) notFound()

  // Get all game results for this player with game info
  const { data: results } = await supabase
    .from('game_results')
    .select(
      `
      champion_name,
      champion_id,
      kills,
      deaths,
      assists,
      perf_score,
      contribution_score,
      games (
        our_team_win
      )
    `,
    )
    .eq('player_id', player.id)

  // Fetch all games to compute all-squad nicknames
  const { data: allGamesRaw } = await supabase
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
        damage_taken,
        healing,
        gold_earned,
        cc_score,
        perf_score,
        contribution_score,
        augment_ids,
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
    .limit(500)

  const allGames = (allGamesRaw ?? []) as unknown as Game[]
  const allNicknames = computeNicknames(allGames)
  const myNicknames: NicknameAward[] = allNicknames.filter(
    (n) => n.winnerPuuid === decodedPuuid,
  )

  // Group by champion
  const championMap = new Map<
    string,
    {
      champion_name: string
      champion_id: number
      games: number
      wins: number
      total_perf: number
      total_contribution: number
      total_kills: number
      total_deaths: number
      total_assists: number
      high_perf_losses: number
    }
  >()

  for (const r of results ?? []) {
    const gameData = r.games as unknown as { our_team_win: boolean } | null
    const win = gameData?.our_team_win ?? false
    const existing = championMap.get(r.champion_name)
    const isHighPerfLoss = (r.perf_score ?? 0) > 60 && !win

    if (!existing) {
      championMap.set(r.champion_name, {
        champion_name: r.champion_name,
        champion_id: r.champion_id,
        games: 1,
        wins: win ? 1 : 0,
        total_perf: r.perf_score ?? 0,
        total_contribution: r.contribution_score ?? 0,
        total_kills: r.kills ?? 0,
        total_deaths: r.deaths ?? 0,
        total_assists: r.assists ?? 0,
        high_perf_losses: isHighPerfLoss ? 1 : 0,
      })
    } else {
      existing.games++
      if (win) existing.wins++
      existing.total_perf += r.perf_score ?? 0
      existing.total_contribution += r.contribution_score ?? 0
      existing.total_kills += r.kills ?? 0
      existing.total_deaths += r.deaths ?? 0
      existing.total_assists += r.assists ?? 0
      if (isHighPerfLoss) existing.high_perf_losses++
    }
  }

  const championReport: ChampionReport[] = [...championMap.values()]
    .map((c) => ({
      champion_name: c.champion_name,
      champion_id: c.champion_id,
      games: c.games,
      wins: c.wins,
      win_rate: c.games > 0 ? Math.round((c.wins / c.games) * 100) : 0,
      avg_perf_score: c.games > 0 ? Math.round((c.total_perf / c.games) * 10) / 10 : 0,
      avg_contribution_score:
        c.games > 0 ? Math.round((c.total_contribution / c.games) * 10) / 10 : 0,
      avg_kills: c.games > 0 ? Math.round((c.total_kills / c.games) * 10) / 10 : 0,
      avg_deaths: c.games > 0 ? Math.round((c.total_deaths / c.games) * 10) / 10 : 0,
      avg_assists: c.games > 0 ? Math.round((c.total_assists / c.games) * 10) / 10 : 0,
      avg_kda:
        c.total_deaths > 0
          ? Math.round(((c.total_kills + c.total_assists) / c.total_deaths) * 10) / 10
          : c.total_kills + c.total_assists,
      is_suspect:
        c.games >= 2 && c.total_perf / c.games > 50 && c.wins / c.games < 0.4,
      high_perf_losses: c.high_perf_losses,
    }))
    .sort((a, b) => b.games - a.games)

  const totalGames = results?.length ?? 0
  const totalWins = championReport.reduce((a, c) => a + c.wins, 0)
  const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

  const suspects = championReport.filter((c) => c.is_suspect)
  const regular = championReport.filter((c) => !c.is_suspect)

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
        ← Back to Dashboard
      </Link>

      {/* Player Header */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{getPlayerDisplayName(player.puuid, player.game_name)}</h1>
            <div className="text-gray-400 text-lg">#{player.tag_line}</div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{totalGames}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wide">Games</div>
            </div>
            <div>
              <div
                className={`text-2xl font-bold ${overallWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}
              >
                {overallWinRate}%
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wide">Win Rate</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">
                {championReport.length}
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wide">Champions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Nickname Badges */}
      {myNicknames.length > 0 && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">🏛️ 나의 별명</h2>
          <div className="flex flex-wrap gap-3">
            {myNicknames.map((award) => (
              <div
                key={award.id}
                className={`bg-gradient-to-br ${award.color} rounded-xl px-4 py-3 border ${award.borderColor} flex items-center gap-3`}
              >
                <span className="text-2xl">{award.emoji}</span>
                <div>
                  <div className={`text-sm font-bold ${award.textColor}`}>{award.name}</div>
                  <div className="text-xs text-gray-300">{award.valueLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suspects Section */}
      {suspects.length > 0 && (
        <div className="bg-orange-950 rounded-2xl border border-orange-700 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔍</span>
            <h2 className="text-xl font-bold text-orange-300">Suspects</h2>
          </div>
          <p className="text-orange-200 text-sm mb-4">
            Good personal stats but low win rate — possible team composition issue or champion mismatch
          </p>
          <div className="space-y-2">
            {suspects.map((c) => (
              <div
                key={c.champion_name}
                className="flex items-center gap-4 bg-orange-900/30 rounded-xl px-4 py-3"
              >
                <ChampionIcon name={c.champion_name} size={36} />
                <div className="flex-1">
                  <div className="font-semibold text-white">{c.champion_name}</div>
                  <div className="text-xs text-orange-300">
                    {c.games} games • {c.high_perf_losses} high-perf losses
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <div className="font-bold text-red-400">{c.win_rate}%</div>
                    <div className="text-xs text-gray-400">Win Rate</div>
                  </div>
                  <div>
                    <div className="font-bold text-blue-400">{c.avg_perf_score}</div>
                    <div className="text-xs text-gray-400">Avg Perf</div>
                  </div>
                  <div>
                    <div className="font-bold text-gray-300">{c.avg_kda}</div>
                    <div className="text-xs text-gray-400">KDA</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Champion Breakdown Table */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Champion Breakdown</h2>
        </div>
        {championReport.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No games recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
                  <th className="px-6 py-3 text-left">Champion</th>
                  <th className="px-4 py-3 text-center">Games</th>
                  <th className="px-4 py-3 text-center">Win%</th>
                  <th className="px-4 py-3 text-center">Avg Perf</th>
                  <th className="px-4 py-3 text-center">Avg Contribution</th>
                  <th className="px-4 py-3 text-center">Avg KDA</th>
                  <th className="px-4 py-3 text-center">K/D/A</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {regular.map((c: ChampionReport) => (
                  <tr key={c.champion_name} className="hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <ChampionIcon name={c.champion_name} size={36} />
                        <span className="text-white font-medium">{c.champion_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-gray-300">{c.games}</td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`font-semibold ${c.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {c.win_rate}%
                      </span>
                      <div className="text-xs text-gray-500">{c.wins}W/{c.games - c.wins}L</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-blue-400 font-semibold">{toDisplayContributionScore(c.avg_perf_score)}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-purple-400 font-semibold">{toDisplayContributionScore(c.avg_contribution_score)}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-gray-300 font-semibold">{c.avg_kda}</span>
                    </td>
                    <td className="px-4 py-4 text-center text-sm">
                      <span className="text-green-400">{c.avg_kills}</span>
                      <span className="text-gray-500 mx-1">/</span>
                      <span className="text-red-400">{c.avg_deaths}</span>
                      <span className="text-gray-500 mx-1">/</span>
                      <span className="text-blue-400">{c.avg_assists}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
