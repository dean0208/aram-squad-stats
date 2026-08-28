'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Game, GameResult } from '@/lib/types'
import type { NicknameAward } from '@/lib/nicknames'
import { calculateMedals } from '@/lib/medals'
import { TRACKED_PLAYERS, DDRAGON_VERSION } from '@/lib/config'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function toKSTDateString(iso: string) {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function todayKST() {
  return toKSTDateString(new Date().toISOString())
}

function formatDisplayDate(ymd: string) {
  const [y, m, d] = ymd.split('-')
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`
}

function ChampionIcon({ name, size = 32 }: { name: string; size?: number }) {
  const safe = name.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <Image
      src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${safe}.png`}
      alt={name} width={size} height={size}
      className="rounded-md" unoptimized
    />
  )
}

// ─── Player profile type inference ───────────────────────────────────────────

function inferPlayerProfile(puuid: string, allGames: Game[]) {
  const results = allGames.flatMap(g =>
    g.game_results.filter(r => r.players?.puuid === puuid).map(r => ({ r, win: g.our_team_win }))
  )
  if (!results.length) return null

  // Most played champ
  const champData = new Map<string, { count: number; wins: number }>()
  for (const { r, win } of results) {
    const prev = champData.get(r.champion_name) ?? { count: 0, wins: 0 }
    champData.set(r.champion_name, { count: prev.count + 1, wins: prev.wins + (win ? 1 : 0) })
  }
  const [mostPlayed, mostData] = [...champData.entries()].sort((a, b) => b[1].count - a[1].count)[0]
  const champWinRate = Math.round((mostData.wins / mostData.count) * 100)

  // Play style — normalize by game count to avoid total inflation
  const total = results.length
  const avgDmg    = results.reduce((a, { r }) => a + r.damage_dealt, 0) / total
  const avgTaken  = results.reduce((a, { r }) => a + r.damage_taken, 0) / total
  const avgHeal   = results.reduce((a, { r }) => a + r.healing, 0) / total
  const avgCC     = results.reduce((a, { r }) => a + r.cc_score, 0) / total

  // 힐러: 힐이 딜보다 현저히 높은 경우
  let type = '올라운더'; let typeEmoji = '⚡'
  if (avgHeal > avgDmg * 0.6 && avgHeal > 5000) { type = '힐러형';  typeEmoji = '💊' }
  else if (avgTaken > avgDmg * 1.5)              { type = '탱커형';  typeEmoji = '🛡️' }
  else if (avgCC > 150)                           { type = 'CC형';    typeEmoji = '🌀' }
  else if (avgDmg > 18000)                        { type = '딜러형';  typeEmoji = '⚔️' }

  return {
    mostPlayed,
    champCount: mostData.count,
    champWinRate,
    type,
    typeEmoji,
  }
}

// ─── Fixed Player Card (all-time) ────────────────────────────────────────────

interface PlayerSummary { id: string; puuid: string; game_name: string; tag_line: string }

function PlayerProfileCard({ player, allGames }: { player: PlayerSummary; allGames: Game[] }) {
  const profile = useMemo(() => inferPlayerProfile(player.puuid, allGames), [player.puuid, allGames])
  if (!profile) return null

  return (
    <div className="bg-gray-800/60 rounded-2xl p-4 border border-gray-700 flex flex-col gap-3">
      <div>
        <div className="font-bold text-white text-base leading-tight">{player.game_name}</div>
        <div className="text-xs text-gray-500">#{player.tag_line}</div>
      </div>

      {/* Champion icon + name */}
      <div className="flex items-center gap-2">
        <ChampionIcon name={profile.mostPlayed} size={36} />
        <div>
          <div className="text-xs text-gray-400">모스트</div>
          <div className="text-sm font-semibold text-yellow-400">{profile.mostPlayed}</div>
          <div className="text-xs text-gray-500">{profile.champCount}판</div>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
          {profile.typeEmoji} {profile.type}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${profile.champWinRate >= 50 ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'}`}>
          승률 {profile.champWinRate}%
        </span>
      </div>
    </div>
  )
}

// ─── MVP Card ─────────────────────────────────────────────────────────────────

function MvpCard({ games }: { games: Game[] }) {
  if (!games.length) return null

  // Find best contribution_score across all results today
  let mvpResult: GameResult | null = null
  let mvpGame: Game | null = null

  for (const game of games) {
    for (const r of game.game_results) {
      if (!r.players) continue
      if (!mvpResult || r.contribution_score > mvpResult.contribution_score) {
        mvpResult = r
        mvpGame = game
      }
    }
  }

  if (!mvpResult || !mvpGame) return null

  return (
    <div className="bg-gradient-to-r from-amber-950 to-yellow-950 border border-amber-700 rounded-2xl p-4 flex items-center gap-4">
      <div className="text-3xl">👑</div>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <ChampionIcon name={mvpResult.champion_name} size={44} />
        <div className="min-w-0">
          <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">오늘의 MVP</div>
          <div className="text-white font-bold text-lg leading-tight">{mvpResult.players?.game_name}</div>
          <div className="text-sm text-amber-300">{mvpResult.champion_name} · {mvpResult.kills}/{mvpResult.deaths}/{mvpResult.assists}</div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-2xl font-black text-amber-300">{mvpResult.contribution_score}</div>
        <div className="text-xs text-amber-500">기여도</div>
      </div>
    </div>
  )
}

// ─── Collapsible Game Row ──────────────────────────────────────────────────────

function GameRow({ game }: { game: Game }) {
  const [open, setOpen] = useState(false)
  const medals = useMemo(() => calculateMedals(game.game_results), [game])

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

  const wins = game.our_team_win
  const mvp = sorted[0]

  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${wins ? 'border-green-800/60' : 'border-red-900/60'}`}>
      {/* Summary row — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-white/5 transition-colors"
      >
        {/* WIN/LOSS */}
        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${wins ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
          {wins ? 'WIN' : 'LOSS'}
        </span>

        {/* Duration */}
        <span className="text-gray-500 text-xs shrink-0">{formatDuration(game.duration_seconds)}</span>

        {/* MVP preview */}
        {mvp && (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <ChampionIcon name={mvp.champion_name} size={24} />
            <span className="text-sm text-gray-300 truncate">
              <span className="text-purple-400 font-semibold">{mvp.players?.game_name}</span>
              <span className="text-gray-500 ml-1">{mvp.kills}/{mvp.deaths}/{mvp.assists}</span>
            </span>
            {resultMedals[mvp.id]?.slice(0, 2).map(({ medal }) => (
              <span key={medal.id} className="text-sm">{medal.emoji}</span>
            ))}
          </div>
        )}

        {/* Chevron */}
        <span className={`shrink-0 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {/* Detail — collapsible */}
      {open && (
        <Link href={`/games/${game.id}`} className="block border-t border-gray-700/50 p-3 sm:p-4 hover:bg-white/5 transition-colors">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sorted.map((result: GameResult) => {
              const myMedals = resultMedals[result.id] ?? []
              return (
                <div key={result.id} className="flex items-center gap-2">
                  <ChampionIcon name={result.champion_name} size={28} />
                  <div className="min-w-0">
                    <div className="text-xs text-gray-300 font-medium truncate">{result.players?.game_name}</div>
                    <div className="text-xs text-gray-500">{result.kills}/{result.deaths}/{result.assists}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs font-bold text-purple-400">{result.contribution_score}</span>
                      {myMedals.slice(0, 3).map(({ medal }) => (
                        <span key={medal.id} className="text-xs">{medal.emoji}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Link>
      )}
    </div>
  )
}

// ─── Date Navigator ───────────────────────────────────────────────────────────

function DateNavigator({ selectedDate, availableDates, onChange }: {
  selectedDate: string
  availableDates: Set<string>
  onChange: (d: string) => void
}) {
  const sorted = useMemo(() => [...availableDates].sort(), [availableDates])
  const idx = sorted.indexOf(selectedDate)
  const pickerRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => idx > 0 && onChange(sorted[idx - 1])}
        disabled={idx <= 0}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg"
      >‹</button>

      <div className="relative">
        <button
          onClick={() => setTimeout(() => pickerRef.current?.showPicker?.(), 0)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:border-purple-500 text-white font-medium text-sm transition-all"
        >
          <span>📅</span>
          <span>{formatDisplayDate(selectedDate)}</span>
        </button>
        <input
          ref={pickerRef} type="date" value={selectedDate}
          onChange={e => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>

      <button
        onClick={() => idx < sorted.length - 1 && onChange(sorted[idx + 1])}
        disabled={idx >= sorted.length - 1}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg"
      >›</button>

      {idx >= 0 && (
        <span className="text-xs text-gray-500 hidden sm:block">
          {idx + 1} / {sorted.length}일
        </span>
      )}
    </div>
  )
}

// ─── Hall of Fame ─────────────────────────────────────────────────────────────

function HallOfFame({ nicknames }: { nicknames: NicknameAward[] }) {
  if (!nicknames.length) return (
    <p className="text-gray-500 text-center py-6 text-sm">게임을 더 싱크해주세요.</p>
  )
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
      {nicknames.map(award => (
        <div key={award.id} className={`bg-gradient-to-br ${award.color} rounded-xl p-3 border ${award.borderColor}`}>
          <div className="text-2xl mb-1">{award.emoji}</div>
          <div className={`text-xs font-bold ${award.textColor}`}>{award.name}</div>
          <div className="text-xs text-gray-400 mb-1 leading-tight">{award.description}</div>
          <div className="text-white font-semibold text-sm">{award.winner}</div>
          <div className="text-xs text-gray-300">{award.valueLabel}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Badge Table ──────────────────────────────────────────────────────────────

const BADGE_DEFS = [
  { id: 'mvp', emoji: '👑', name: 'MVP' },
  { id: 'dealer', emoji: '⚔️', name: '딜장인' },
  { id: 'gold', emoji: '💰', name: '골드왕' },
  { id: 'healer', emoji: '💊', name: '힐봇' },
  { id: 'tank', emoji: '🛡️', name: '인간방패' },
  { id: 'killer', emoji: '🎯', name: '킬머신' },
  { id: 'assist', emoji: '🤝', name: '어시왕' },
  { id: 'death', emoji: '💀', name: '죽어줘' },
  { id: 'passive', emoji: '🐔', name: '꽁꽁이' },
]

function buildBadgeCounts(games: Game[]) {
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

function BadgeTable({ games, players }: { games: Game[]; players: PlayerSummary[] }) {
  const leaderboard = useMemo(() => buildBadgeCounts(games), [games])
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm min-w-[400px]">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
            <th className="px-4 py-3 text-left">플레이어</th>
            {BADGE_DEFS.map(b => (
              <th key={b.id} className="px-2 py-3 text-center" title={b.name}>{b.emoji}</th>
            ))}
            <th className="px-4 py-3 text-right">합계</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {players.map(p => {
            const my = leaderboard[p.game_name] ?? {}
            const total = Object.values(my).reduce((a, b) => a + b, 0)
            return (
              <tr key={p.puuid} className="hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium text-white text-sm">{p.game_name}</td>
                {BADGE_DEFS.map(b => (
                  <td key={b.id} className="px-2 py-3 text-center">
                    {my[b.id]
                      ? <span className="font-bold text-yellow-400">{my[b.id]}</span>
                      : <span className="text-gray-600">—</span>}
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

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  allGames: Game[]
  players: PlayerSummary[]
  initialNicknames: NicknameAward[]
}

export default function DashboardClient({ allGames, players, initialNicknames }: Props) {
  const availableDates = useMemo(() => {
    const s = new Set<string>()
    for (const g of allGames) s.add(toKSTDateString(g.played_at))
    return s
  }, [allGames])

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const dates = allGames.map(g => toKSTDateString(g.played_at)).sort()
    return dates[dates.length - 1] ?? todayKST()
  })

  // Sync when allGames changes
  useEffect(() => {
    const dates = allGames.map(g => toKSTDateString(g.played_at)).sort()
    const latest = dates[dates.length - 1] ?? todayKST()
    setSelectedDate(latest)
  }, [allGames])

  // Animate on date change
  const [animKey, setAnimKey] = useState(0)
  const handleDateChange = (d: string) => {
    setSelectedDate(d)
    setAnimKey(k => k + 1)
  }

  const filteredGames = useMemo(
    () => allGames.filter(g => toKSTDateString(g.played_at) === selectedDate),
    [allGames, selectedDate]
  )

  // Sort players by config order
  const orderedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const ai = TRACKED_PLAYERS.findIndex(p => p.puuid === a.puuid)
      const bi = TRACKED_PLAYERS.findIndex(p => p.puuid === b.puuid)
      return ai - bi
    })
  }, [players])

  return (
    <div className="space-y-6">

      {/* ── 고정 플레이어 프로필 ── */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {orderedPlayers.map(p => (
            <Link key={p.puuid} href={`/players/${encodeURIComponent(p.puuid)}`}>
              <PlayerProfileCard player={p} allGames={allGames} />
            </Link>
          ))}
        </div>
      </section>

      {/* ── 날짜 탐색 ── */}
      <DateNavigator
        selectedDate={selectedDate}
        availableDates={availableDates}
        onChange={handleDateChange}
      />

      {/* ── 날짜별 콘텐츠 (애니메이션) ── */}
      <div
        key={animKey}
        className="space-y-4"
        style={{ animation: 'fadeSlideIn 0.25s ease-out' }}
      >
        {/* MVP */}
        {filteredGames.length > 0 && <MvpCard games={filteredGames} />}

        {/* 당일 게임 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold text-gray-300">당일 게임</h2>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
              {filteredGames.length}경기
            </span>
          </div>
          {filteredGames.length === 0
            ? <p className="text-gray-500 text-center py-8 text-sm">해당 날짜에 기록된 게임이 없습니다</p>
            : (
              <div className="space-y-2">
                {filteredGames.map(g => <GameRow key={g.id} game={g} />)}
              </div>
            )
          }
        </section>
      </div>

      {/* ── 명예의 전당 (누적) ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-gray-300">🏛️ 명예의 전당</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">전체 누적</span>
        </div>
        <HallOfFame nicknames={initialNicknames} />
      </section>

      {/* ── 뱃지 리더보드 (누적) ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-gray-300">🏅 뱃지 리더보드</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">전체 기록</span>
        </div>
        <div className="bg-gray-800/60 rounded-2xl border border-gray-700 overflow-hidden">
          <BadgeTable games={allGames} players={orderedPlayers} />
        </div>
      </section>
    </div>
  )
}
