'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Game, GameResult } from '@/lib/types'
import type { NicknameAward } from '@/lib/nicknames'
import { calculateMedals } from '@/lib/medals'
import { DDRAGON_VERSION } from '@/lib/config'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function ChampionIcon({ name, size = 28 }: { name: string; size?: number }) {
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

// ─── Period filter ────────────────────────────────────────────────────────────

type Period = 5 | 10 | 30 | 0  // 0 = all

const PERIOD_LABELS: Record<Period, string> = {
  5: '최근 5경기',
  10: '최근 10경기',
  30: '최근 30경기',
  0: '전체',
}

// ─── Badge Leaderboard ────────────────────────────────────────────────────────

const BADGE_DEFS = [
  { id: 'mvp',     emoji: '👑', name: 'MVP' },
  { id: 'dealer',  emoji: '⚔️',  name: '딜장인' },
  { id: 'gold',    emoji: '💰', name: '골드왕' },
  { id: 'healer',  emoji: '💊', name: '힐봇' },
  { id: 'tank',    emoji: '🛡️', name: '인간방패' },
  { id: 'killer',  emoji: '🎯', name: '킬머신' },
  { id: 'assist',  emoji: '🤝', name: '어시왕' },
  { id: 'death',   emoji: '💀', name: '죽어줘' },
  { id: 'passive', emoji: '🐔', name: '꽁꽁이' },
]

function buildBadgeLeaderboard(games: Game[]): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = {}
  for (const game of games) {
    const medals = calculateMedals(game.game_results)
    for (const { medal, winners } of medals) {
      if (winners.length === 1 && winners[0].players) {
        const name = winners[0].players.game_name
        if (!counts[name]) counts[name] = {}
        counts[name][medal.id] = (counts[name][medal.id] ?? 0) + 1
      }
    }
  }
  return counts
}

// ─── PlayerCard (period-filtered) ────────────────────────────────────────────

interface PlayerSummary {
  id: string
  puuid: string
  game_name: string
  tag_line: string
}

function computePlayerStats(summary: PlayerSummary, games: Game[]) {
  const results = games.flatMap((g) =>
    g.game_results.filter((r) => r.players?.puuid === summary.puuid).map((r) => ({ r, win: g.our_team_win })),
  )

  const total = results.length
  const wins = results.filter((x) => x.win).length
  const avgContrib =
    total > 0
      ? Math.round((results.reduce((a, x) => a + x.r.contribution_score, 0) / total) * 10) / 10
      : 0

  const champCounts = new Map<string, number>()
  for (const { r } of results) {
    champCounts.set(r.champion_name, (champCounts.get(r.champion_name) ?? 0) + 1)
  }
  const bestChamp = [...champCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  return {
    total,
    wins,
    win_rate: total > 0 ? Math.round((wins / total) * 100) : 0,
    avg_contribution: avgContrib,
    best_champion: bestChamp,
  }
}

// ─── GameRow with medals ───────────────────────────────────────────────────────

function GameRow({ game }: { game: Game }) {
  const medals = calculateMedals(game.game_results)
  // Build a map: resultId -> medals
  const resultMedals: Record<string, typeof medals> = {}
  for (const m of medals) {
    for (const w of m.winners) {
      if (!resultMedals[w.id]) resultMedals[w.id] = []
      resultMedals[w.id].push(m)
    }
  }

  const sorted = [...game.game_results]
    .filter((r: GameResult) => r.players)
    .sort((a: GameResult, b: GameResult) => b.contribution_score - a.contribution_score)

  return (
    <Link
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
        {sorted.map((result: GameResult) => {
          const myMedals = resultMedals[result.id] ?? []
          return (
            <div key={result.id} className="flex items-center gap-2">
              <ChampionIcon name={result.champion_name} size={28} />
              <div>
                <div className="text-xs text-gray-300">{result.players?.game_name}</div>
                <div className="text-xs text-gray-500">
                  {result.champion_name} • {result.kills}/{result.deaths}/{result.assists}
                </div>
              </div>
              <div className="ml-1 text-xs font-bold text-purple-400">
                {result.contribution_score}
              </div>
              {/* Medal icons */}
              {myMedals.length > 0 && (
                <div className="flex gap-0.5">
                  {myMedals.map(({ medal }) => (
                    <span
                      key={medal.id}
                      title={`${medal.name}: ${result.players?.game_name}`}
                      className="text-xs cursor-default"
                    >
                      {medal.emoji}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Link>
  )
}

// ─── Hall of Fame ─────────────────────────────────────────────────────────────

function HallOfFame({ nicknames, period }: { nicknames: NicknameAward[]; period: Period }) {
  if (nicknames.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">
        데이터가 부족합니다. 게임을 더 싱크해주세요.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {nicknames.map((award) => (
        <div
          key={award.id}
          className={`bg-gradient-to-br ${award.color} rounded-xl p-4 border ${award.borderColor}`}
        >
          <div className="text-3xl mb-1">{award.emoji}</div>
          <div className={`text-sm font-bold ${award.textColor}`}>{award.name}</div>
          <div className="text-xs text-gray-400 mb-2">{award.description}</div>
          <div className="text-white font-semibold text-sm">{award.winner}</div>
          <div className="text-xs text-gray-300 mt-0.5">{award.valueLabel}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Badge Leaderboard Table ───────────────────────────────────────────────────

function BadgeTable({ games, players }: { games: Game[]; players: PlayerSummary[] }) {
  const leaderboard = buildBadgeLeaderboard(games)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
            <th className="px-4 py-3 text-left">플레이어</th>
            {BADGE_DEFS.map((b) => (
              <th key={b.id} className="px-2 py-3 text-center" title={b.name}>
                {b.emoji}
              </th>
            ))}
            <th className="px-4 py-3 text-right">합계</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {players.map((p) => {
            const myBadges = leaderboard[p.game_name] ?? {}
            const total = Object.values(myBadges).reduce((a, b) => a + b, 0)
            return (
              <tr key={p.puuid} className="hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{p.game_name}</td>
                {BADGE_DEFS.map((b) => (
                  <td key={b.id} className="px-2 py-3 text-center text-gray-300">
                    {myBadges[b.id] ? (
                      <span className="font-bold text-yellow-400">{myBadges[b.id]}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-bold text-purple-400">{total || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Dashboard Client Component ─────────────────────────────────────────

interface DashboardClientProps {
  allGames: Game[]
  players: PlayerSummary[]
  initialNicknames: NicknameAward[]
}

export default function DashboardClient({
  allGames,
  players,
  initialNicknames,
}: DashboardClientProps) {
  const [period, setPeriod] = useState<Period>(10)
  const [filteredGames, setFilteredGames] = useState<Game[]>([])
  const [nicknames, setNicknames] = useState<NicknameAward[]>(initialNicknames)
  const [loadingNicknames, setLoadingNicknames] = useState(false)

  // Apply period filter locally
  useEffect(() => {
    if (period === 0) {
      setFilteredGames(allGames)
    } else {
      setFilteredGames(allGames.slice(0, period))
    }
  }, [period, allGames])

  // Reload nicknames from API when period changes
  const fetchNicknames = useCallback(async (p: Period) => {
    setLoadingNicknames(true)
    try {
      const url = p === 0 ? '/api/players/badges' : `/api/players/badges?limit=${p}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.nicknames) setNicknames(data.nicknames)
    } catch {
      // keep existing
    } finally {
      setLoadingNicknames(false)
    }
  }, [])

  useEffect(() => {
    fetchNicknames(period)
  }, [period, fetchNicknames])

  const periods: Period[] = [5, 10, 30, 0]

  return (
    <div className="space-y-8">
      {/* Period Filter */}
      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === p
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Player Cards */}
      <section>
        <h2 className="text-xl font-semibold text-gray-300 mb-4">Players</h2>
        {players.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No data yet — click &quot;Sync Games&quot; to pull match history
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {players.map((player) => {
              const stats = computePlayerStats(player, filteredGames)
              return (
                <Link
                  key={player.puuid}
                  href={`/players/${encodeURIComponent(player.puuid)}`}
                  className="block bg-gray-800 rounded-xl p-5 hover:bg-gray-750 hover:border-purple-600 border border-gray-700 transition-all"
                >
                  <div className="font-semibold text-white text-lg">{player.game_name}</div>
                  <div className="text-sm text-gray-400 mb-3">#{player.tag_line}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Games</span>
                      <span className="text-white font-medium">{stats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Win Rate</span>
                      <span
                        className={stats.win_rate >= 50 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}
                      >
                        {stats.win_rate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg Contribution</span>
                      <span className="text-purple-400 font-medium">{stats.avg_contribution}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Most Played</span>
                      <span className="text-yellow-400 font-medium">{stats.best_champion}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Hall of Fame – Nickname Awards */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold text-gray-300">🏛️ 명예의 전당</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">
            {PERIOD_LABELS[period]} 기준
          </span>
          {loadingNicknames && <span className="text-xs text-gray-500 animate-pulse">로딩 중…</span>}
        </div>
        <HallOfFame nicknames={nicknames} period={period} />
      </section>

      {/* Recent Games */}
      <section>
        <h2 className="text-xl font-semibold text-gray-300 mb-4">
          Recent Games
          <span className="ml-2 text-sm text-gray-500 font-normal">
            ({filteredGames.length}경기)
          </span>
        </h2>
        {filteredGames.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No games recorded yet</p>
        ) : (
          <div className="space-y-3">
            {filteredGames.map((game) => (
              <GameRow key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>

      {/* All-time Badge Leaderboard – always full */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold text-gray-300">🏅 뱃지 리더보드</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">
            전체 기록
          </span>
        </div>
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <BadgeTable games={allGames} players={players} />
        </div>
      </section>
    </div>
  )
}
