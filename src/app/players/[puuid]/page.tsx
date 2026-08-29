import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createServerClient } from '@/lib/supabase'
import { DDRAGON_VERSION, getPlayerDisplayName } from '@/lib/config'
import { toDisplayContributionScore } from '@/lib/displayScore'
import { fetchChampionCatalog, getChampionDisplayName } from '@/lib/championNames'
import { recommendChampion } from '@/lib/championRecommendations'
import type { ChampionReport, Game } from '@/lib/types'
import { computeNicknames } from '@/lib/nicknames'
import type { NicknameAward } from '@/lib/nicknames'
import { analyzeRecentFiveGames } from '@/lib/playerInsights'

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

function ChampionBreakdownTable({ champions, championNames }: {
  champions: ChampionReport[]
  championNames: Record<string, string>
}) {
  if (!champions.length) {
    return <div className="px-4 py-8 text-center text-sm text-gray-500">해당 구간에 챔피언 기록이 없습니다</div>
  }

  return (
    <div className="champion-breakdown">
      {champions.length > 3 && (
        <details className="champion-toggle border-b border-gray-700">
          <summary className="px-5 py-3 text-xs font-medium text-blue-500 hover:bg-blue-50/50">
            전체 챔피언 {champions.length}개 보기 · TOP3 외 {champions.length - 3}개
          </summary>
        </details>
      )}
      <div className="champion-table-wrap">
      <table className="w-full table-fixed">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
            <th className="w-[27%] px-2 py-3 text-left sm:w-auto sm:px-6">챔피언</th>
            <th className="w-[13%] px-1 py-3 text-center sm:w-auto sm:px-4">경기</th>
            <th className="w-[15%] px-1 py-3 text-center sm:w-auto sm:px-4">승률</th>
            <th className="w-[17%] px-1 py-3 text-center sm:w-auto sm:px-4">평균 성능</th>
            <th className="hidden px-4 py-3 text-center sm:table-cell">평균 기여도</th>
            <th className="hidden px-4 py-3 text-center sm:table-cell">평균 KDA</th>
            <th className="w-[28%] px-1 py-3 text-center sm:w-auto sm:px-4">킬/데스/어시</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {champions.map((c, index) => (
            <tr key={c.champion_name} className={`${index >= 3 ? 'champion-extra-row ' : ''}hover:bg-gray-750 transition-colors`}>
              <td className="px-2 py-3 sm:px-6 sm:py-4">
                <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
                  <ChampionIcon name={c.champion_name} size={36} />
                  <span className="max-w-full text-center text-xs font-medium leading-tight text-white sm:text-left sm:text-base">{getChampionDisplayName(c.champion_name, championNames)}</span>
                </div>
              </td>
              <td className="px-1 py-3 text-center text-gray-300 sm:px-4 sm:py-4">{c.games}</td>
              <td className="px-1 py-3 text-center sm:px-4 sm:py-4">
                <span className={`font-semibold ${c.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                  {c.win_rate}%
                </span>
                <div className="text-xs text-gray-500">{c.wins}승/{c.games - c.wins}패</div>
              </td>
              <td className="px-1 py-3 text-center sm:px-4 sm:py-4">
                <span className="text-blue-400 font-semibold">{toDisplayContributionScore(c.avg_perf_score)}</span>
              </td>
              <td className="hidden px-4 py-4 text-center sm:table-cell">
                <span className="text-purple-400 font-semibold">{toDisplayContributionScore(c.avg_contribution_score)}</span>
              </td>
              <td className="hidden px-4 py-4 text-center sm:table-cell">
                <span className="text-gray-300 font-semibold">{c.avg_kda}</span>
              </td>
              <td className="px-1 py-3 text-center text-xs sm:px-4 sm:py-4 sm:text-sm">
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
    </div>
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
  const championCatalogPromise = fetchChampionCatalog()

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
  const championCatalog = await championCatalogPromise
  const championNames = Object.fromEntries(championCatalog.map(champion => [champion.id, champion.name]))
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

  const recommendation = recommendChampion(championReport, championCatalog)

  const primaryChampion = championReport[0]
  const primaryCatalogEntry = championCatalog.find(champion => champion.id === primaryChampion?.champion_name)
  const roleLabel = ({
    Marksman: '원딜', Mage: '마법사', Tank: '탱커', Fighter: '브루저',
    Support: '서포터', Assassin: '암살자',
  } as Record<string, string>)[primaryCatalogEntry?.tags[0] ?? ''] ?? '플레이어'
  const recentFiveSnapshots = allGames
    .slice()
    .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
    .flatMap(game => {
      const playerResult = game.game_results.find(result => result.players?.puuid === decodedPuuid)
      if (!playerResult) return []
      const teamResults = game.game_results.filter(result => result.players)
      const average = (field: 'damage_dealt' | 'assists' | 'deaths') =>
        teamResults.reduce((sum, result) => sum + result[field], 0) / Math.max(1, teamResults.length)
      return [{
        champion: playerResult.champion_name,
        win: game.our_team_win,
        kills: playerResult.kills,
        deaths: playerResult.deaths,
        assists: playerResult.assists,
        damage: playerResult.damage_dealt,
        teamDamageAverage: average('damage_dealt'),
        teamAssistsAverage: average('assists'),
        teamDeathsAverage: average('deaths'),
        perf: playerResult.perf_score,
      }]
    })
    .slice(0, 5)
  const recentAnalysis = analyzeRecentFiveGames(recentFiveSnapshots, roleLabel)

  const totalGames = results?.length ?? 0
  const totalWins = championReport.reduce((a, c) => a + c.wins, 0)
  const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

  const suspects = championReport.filter((c) => c.is_suspect)
  const regular = championReport.filter((c) => !c.is_suspect)
  const strongChampions = regular.filter((c) => toDisplayContributionScore(c.avg_contribution_score) >= 50)
  const weakChampions = regular.filter((c) => toDisplayContributionScore(c.avg_contribution_score) < 50)

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
        ← 대시보드로 돌아가기
      </Link>

      {/* Player Header */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{getPlayerDisplayName(player.puuid, player.game_name)}</h1>
            <div className="text-gray-400 text-base sm:text-lg">#{player.tag_line}</div>
          </div>
          <div className="grid w-full grid-cols-3 gap-3 text-center sm:w-auto sm:gap-6">
            <div>
              <div className="text-2xl font-bold text-white">{totalGames}</div>
              <div className="text-sm text-gray-400 tracking-wide">게임 수</div>
            </div>
            <div>
              <div
                className={`text-2xl font-bold ${overallWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}
              >
                {overallWinRate}%
              </div>
              <div className="text-sm text-gray-400 tracking-wide">승률</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">
                {championReport.length}
              </div>
              <div className="text-sm text-gray-400 tracking-wide">챔피언 수</div>
            </div>
          </div>
        </div>
      </div>

      {recommendation && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 px-5 py-4">
          <div className="text-xs font-semibold text-blue-500 mb-2">🧭 한줄 분석</div>
          <div className="flex items-center gap-3">
            <ChampionIcon name={recommendation.championId} size={40} />
            <p className="text-sm font-medium text-gray-700 leading-relaxed">{recommendation.reason}</p>
          </div>
        </div>
      )}

      {recentFiveSnapshots.length > 0 && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">📈 {recentAnalysis.headline}</h2>
            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">세부 지표 분석</span>
          </div>
          <ul className="space-y-2">
            {recentAnalysis.details.map(detail => (
              <li key={detail} className="text-sm leading-relaxed text-gray-300">• {detail}</li>
            ))}
          </ul>
        </div>
      )}

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
            <h2 className="text-xl font-bold text-orange-300">의심 챔피언</h2>
          </div>
          <p className="text-orange-200 text-sm mb-4">
            개인 기록은 좋지만 승률이 낮아요 — 팀 조합이나 챔피언 궁합을 확인해보세요
          </p>
          <div className="space-y-2">
            {suspects.map((c) => (
              <div
                key={c.champion_name}
                className="flex flex-col gap-3 bg-orange-900/30 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <ChampionIcon name={c.champion_name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white">{getChampionDisplayName(c.champion_name, championNames)}</div>
                  <div className="text-xs text-orange-300">
                    {c.games}경기 · 고성능 패배 {c.high_perf_losses}회
                  </div>
                </div>
                <div className="grid w-full grid-cols-3 gap-2 text-center text-sm sm:w-auto sm:gap-4">
                  <div>
                    <div className="font-bold text-red-400">{c.win_rate}%</div>
                    <div className="text-xs text-gray-400">승률</div>
                  </div>
                  <div>
                    <div className="font-bold text-blue-400">{c.avg_perf_score}</div>
                    <div className="text-xs text-gray-400">평균 성능</div>
                  </div>
                  <div>
                    <div className="font-bold text-gray-300">{c.avg_kda}</div>
                    <div className="text-xs text-gray-400">평균 KDA</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {championReport.length === 0 ? (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 text-center py-12 text-gray-500">
          아직 기록된 게임이 없습니다
        </div>
      ) : (
        <div className="space-y-6">
          <details open className="champion-section bg-gray-800 rounded-2xl border border-green-200 overflow-hidden">
            <summary className="px-5 py-4 border-b border-gray-700 hover:bg-green-50/50">
              <h2 className="text-lg font-semibold text-green-500">🔥 좀 치노</h2>
              <p className="text-xs text-gray-500 mt-1">기여도 지수 50점 이상</p>
            </summary>
            <ChampionBreakdownTable champions={strongChampions} championNames={championNames} />
          </details>

          <details open className="champion-section bg-gray-800 rounded-2xl border border-red-200 overflow-hidden">
            <summary className="px-5 py-4 border-b border-gray-700 hover:bg-red-50/50">
              <h2 className="text-lg font-semibold text-red-500">😅 별론데?</h2>
              <p className="text-xs text-gray-500 mt-1">기여도 지수 50점 미만</p>
            </summary>
            <ChampionBreakdownTable champions={weakChampions} championNames={championNames} />
          </details>
        </div>
      )}
    </div>
  )
}
