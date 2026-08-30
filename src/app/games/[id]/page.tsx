import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createServerClient } from '@/lib/supabase'
import { DDRAGON_VERSION, getPlayerDisplayName } from '@/lib/config'
import { fetchChampionNames, getChampionDisplayName } from '@/lib/championNames'
import { toDisplayContributionScore } from '@/lib/displayScore'
import type { Game, GameResult } from '@/lib/types'
import { calculateMedals } from '@/lib/medals'
import { normalizeGame } from '@/lib/normalized'

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
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function ChampionIcon({ name, size = 40 }: { name: string; size?: number }) {
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

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
      <div
        className="bg-purple-500 h-1.5 rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServerClient()

  const { data: game } = await supabase
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
    .eq('id', id)
    .single()

  if (!game) notFound()

  const typedGame = game as unknown as Game
  const normalizedGame = normalizeGame(typedGame)
  const championNames = await fetchChampionNames()

  // Sort by contribution score descending to find MVP
  const sortedResults = [...typedGame.game_results].sort(
    (a, b) => b.contribution_score - a.contribution_score,
  )
  const mvpId = sortedResults[0]?.id

  // Compute game-level medals
  const medals = calculateMedals(typedGame.game_results)
  // Build map: resultId -> medals won
  const resultMedals: Record<string, typeof medals> = {}
  for (const m of medals) {
    for (const w of m.winners) {
      if (!resultMedals[w.id]) resultMedals[w.id] = []
      resultMedals[w.id].push(m)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Back
        </Link>
      </div>

      {/* Win/Loss Banner */}
      <div
        className={`rounded-2xl p-6 border ${
          typedGame.our_team_win
            ? 'bg-green-950 border-green-700'
            : 'bg-red-950 border-red-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div
              className={`text-4xl font-black ${
                typedGame.our_team_win ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {typedGame.our_team_win ? 'VICTORY' : 'DEFEAT'}
            </div>
            <div className="text-gray-400 mt-1">
              {formatDate(typedGame.played_at)} • {formatDuration(typedGame.duration_seconds)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Match ID</div>
            <div className="text-xs text-gray-500 font-mono">{typedGame.match_id}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e5e8eb] bg-white px-4 py-3 text-sm text-[#4e5968]">
        <span className="font-semibold text-[#191f28]">데이터 상태</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${normalizedGame.dataQuality === 'COMPLETE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {normalizedGame.dataQuality === 'COMPLETE' ? '완전 데이터' : '부분 데이터'}
        </span>
        {normalizedGame.dataQuality !== 'COMPLETE' && <span>선수 또는 챔피언 원본 정보가 일부 없습니다.</span>}
      </div>

      {/* Player Scores Table */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">플레이어 기여도</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
                <th className="px-6 py-3 text-left">Player</th>
                <th className="px-4 py-3 text-left">Champion</th>
                <th className="px-4 py-3 text-center">K/D/A</th>
                <th className="px-4 py-3 text-right">Damage</th>
                <th className="px-4 py-3 text-right">Taken</th>
                <th className="px-4 py-3 text-right">Healing</th>
                <th className="px-4 py-3 text-right">Perf</th>
                <th className="px-4 py-3 text-right">Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sortedResults.map((result: GameResult) => (
                <tr
                  key={result.id}
                  className="hover:bg-gray-750 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {result.id === mvpId && (
                        <span className="text-yellow-400 text-lg" title="MVP">
                          👑
                        </span>
                      )}
                      <div>
                        <div className="font-medium text-white">
                          {result.players ? (
                            <Link
                              href={`/players/${encodeURIComponent(result.players.puuid)}`}
                              className="hover:text-purple-400 transition-colors"
                            >
                              {getPlayerDisplayName(result.players.puuid, result.players.game_name)}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </div>
                        {result.players && (
                          <div className="text-xs text-gray-500">
                            #{result.players.tag_line}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <ChampionIcon name={result.champion_name} size={36} />
                      <span className="text-sm text-gray-300">{getChampionDisplayName(result.champion_name, championNames)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-green-400 font-medium">{result.kills}</span>
                    <span className="text-gray-500 mx-1">/</span>
                    <span className="text-red-400 font-medium">{result.deaths}</span>
                    <span className="text-gray-500 mx-1">/</span>
                    <span className="text-blue-400 font-medium">{result.assists}</span>
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-orange-300 font-medium">
                    {formatNumber(result.damage_dealt)}
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-yellow-300 font-medium">
                    {formatNumber(result.damage_taken)}
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-green-300 font-medium">
                    {formatNumber(result.healing)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="text-sm font-bold text-blue-400">
                      {toDisplayContributionScore(result.perf_score)}
                    </div>
                    <ScoreBar value={toDisplayContributionScore(result.perf_score)} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="text-sm font-bold text-purple-400">
                      {toDisplayContributionScore(result.contribution_score)}
                    </div>
                    <ScoreBar value={toDisplayContributionScore(result.contribution_score)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Game Awards */}
      {medals.length > 0 && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">🏅 이번 판 수상자</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {medals.map(({ medal, winners }) => (
              <div
                key={medal.id}
                className={`rounded-xl p-3 border ${
                  medal.shame
                    ? 'bg-gray-900 border-gray-600'
                    : 'bg-gray-750 border-gray-600'
                }`}
              >
                <div className="text-2xl mb-1">{medal.emoji}</div>
                <div
                  className={`text-xs font-bold mb-1 ${
                    medal.shame ? 'text-gray-400' : 'text-gray-200'
                  }`}
                >
                  {medal.name}
                </div>
                <div className="text-xs text-gray-300 font-medium">
                  {winners.map((w) => w.players ? getPlayerDisplayName(w.players.puuid, w.players.game_name) : '?').join(', ')}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{medal.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Augments */}
      {sortedResults.some((r) => r.augment_ids?.length > 0) && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Augments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sortedResults
              .filter((r) => r.augment_ids?.length > 0)
              .map((result) => (
                <div key={result.id} className="flex items-start gap-3">
                  <ChampionIcon name={result.champion_name} size={28} />
                  <div>
                    <div className="text-sm text-gray-300 font-medium">
                      {result.players ? getPlayerDisplayName(result.players.puuid, result.players.game_name) : '—'} ({getChampionDisplayName(result.champion_name, championNames)})
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {result.augment_ids.map((augId, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded font-mono"
                        >
                          #{augId}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
