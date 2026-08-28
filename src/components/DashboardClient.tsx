'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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

function toKSTDateString(iso: string): string {
  // Returns "YYYY-MM-DD" in KST
  const d = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function todayKST(): string {
  return toKSTDateString(new Date().toISOString())
}

function formatDisplayDate(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`
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

// ─── PlayerCard ────────────────────────────────────────────────────────────

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

function HallOfFame({ nicknames }: { nicknames: NicknameAward[] }) {
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

// ─── Date Navigator ───────────────────────────────────────────────────────────

interface DateNavigatorProps {
  selectedDate: string      // "YYYY-MM-DD"
  availableDates: Set<string>
  onChange: (date: string) => void
}

function DateNavigator({ selectedDate, availableDates, onChange }: DateNavigatorProps) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLInputElement>(null)

  const sortedDates = useMemo(
    () => [...availableDates].sort(),
    [availableDates],
  )

  const currentIndex = sortedDates.indexOf(selectedDate)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < sortedDates.length - 1

  const goPrev = () => hasPrev && onChange(sortedDates[currentIndex - 1])
  const goNext = () => hasNext && onChange(sortedDates[currentIndex + 1])

  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value // "YYYY-MM-DD"
    if (v) onChange(v)
    setShowPicker(false)
  }

  return (
    <div className="flex items-center gap-3">
      {/* Prev arrow */}
      <button
        onClick={goPrev}
        disabled={!hasPrev}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        title="이전 날"
      >
        ‹
      </button>

      {/* Date display + calendar */}
      <div className="relative">
        <button
          onClick={() => {
            setShowPicker(true)
            setTimeout(() => pickerRef.current?.showPicker?.(), 0)
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-purple-500 transition-all text-white font-medium text-sm"
        >
          <span>📅</span>
          <span>{formatDisplayDate(selectedDate)}</span>
        </button>
        {/* Hidden native date input */}
        <input
          ref={pickerRef}
          type="date"
          value={selectedDate}
          onChange={handleCalendarChange}
          onBlur={() => setShowPicker(false)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          style={{ pointerEvents: showPicker ? 'auto' : 'none' }}
        />
      </div>

      {/* Next arrow */}
      <button
        onClick={goNext}
        disabled={!hasNext}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        title="다음 날"
      >
        ›
      </button>

      {/* Today shortcut */}
      {selectedDate !== todayKST() && availableDates.has(todayKST()) && (
        <button
          onClick={() => onChange(todayKST())}
          className="px-3 py-2 rounded-lg bg-purple-900 border border-purple-700 text-purple-300 text-xs font-medium hover:bg-purple-800 transition-all"
        >
          오늘
        </button>
      )}

      {availableDates.size > 0 && (
        <span className="text-xs text-gray-500">
          {currentIndex >= 0 ? `${currentIndex + 1} / ${sortedDates.length}일` : '해당 날짜 없음'}
        </span>
      )}
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
  // Build set of dates that have games (KST)
  const availableDates = useMemo(() => {
    const s = new Set<string>()
    for (const g of allGames) s.add(toKSTDateString(g.played_at))
    return s
  }, [allGames])

  // Default: most recent date with games (or today)
  const defaultDate = useMemo(() => {
    const sorted = [...availableDates].sort()
    return sorted[sorted.length - 1] ?? todayKST()
  }, [availableDates])

  const [selectedDate, setSelectedDate] = useState<string>(defaultDate)

  // Update default when data loads
  useEffect(() => {
    setSelectedDate(defaultDate)
  }, [defaultDate])

  // Filter games by selected KST date
  const filteredGames = useMemo(() => {
    return allGames.filter((g) => toKSTDateString(g.played_at) === selectedDate)
  }, [allGames, selectedDate])

  return (
    <div className="space-y-8">
      {/* Date Navigator */}
      <DateNavigator
        selectedDate={selectedDate}
        availableDates={availableDates}
        onChange={setSelectedDate}
      />

      {/* Player Cards — based on selected date */}
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

      {/* Games of the day */}
      <section>
        <h2 className="text-xl font-semibold text-gray-300 mb-4">
          당일 게임
          <span className="ml-2 text-sm text-gray-500 font-normal">
            ({filteredGames.length}경기)
          </span>
        </h2>
        {filteredGames.length === 0 ? (
          <p className="text-gray-500 text-center py-8">해당 날짜에 기록된 게임이 없습니다</p>
        ) : (
          <div className="space-y-3">
            {filteredGames.map((game) => (
              <GameRow key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>

      {/* Hall of Fame — always full history */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold text-gray-300">🏛️ 명예의 전당</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">
            전체 누적 기준
          </span>
        </div>
        <HallOfFame nicknames={initialNicknames} />
      </section>

      {/* All-time Badge Leaderboard */}
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
