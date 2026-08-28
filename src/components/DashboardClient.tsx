'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
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
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
function todayKST() { return toKSTDateString(new Date().toISOString()) }
function formatDisplayDate(ymd: string) {
  const [y, m, d] = ymd.split('-')
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`
}

function ChampionIcon({ name, size = 32 }: { name: string; size?: number }) {
  const safe = name.replace(/[^a-zA-Z0-9]/g, '')
  return (
    <Image
      src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${safe}.png`}
      alt={name} width={size} height={size} className="rounded-md" unoptimized
    />
  )
}

// ─── Player stat computation ──────────────────────────────────────────────────

type ChampRoleMap = Record<string, { label: string; emoji: string }>

function computePlayerStats(puuid: string, allGames: Game[], champRoles: ChampRoleMap) {
  const entries = allGames.flatMap(g =>
    g.game_results.filter(r => r.players?.puuid === puuid).map(r => ({ r, win: g.our_team_win }))
  )
  if (!entries.length) return null

  const total = entries.length

  // Most played champ + best contribution champ
  const champData = new Map<string, { count: number; wins: number; totalContrib: number }>()
  for (const { r, win } of entries) {
    const prev = champData.get(r.champion_name) ?? { count: 0, wins: 0, totalContrib: 0 }
    champData.set(r.champion_name, {
      count: prev.count + 1,
      wins: prev.wins + (win ? 1 : 0),
      totalContrib: prev.totalContrib + r.contribution_score,
    })
  }
  const [mostChamp, mostInfo] = [...champData.entries()].sort((a, b) => b[1].count - a[1].count)[0]
  const champWinRate = Math.round((mostInfo.wins / mostInfo.count) * 100)
  const role = champRoles[mostChamp] ?? { label: '올라운더', emoji: '⚡' }

  // Best avg contribution champ (최소 3판 이상)
  const bestContribChamp = [...champData.entries()]
    .filter(([, d]) => d.count >= 3)
    .sort((a, b) => b[1].totalContrib / b[1].count - a[1].totalContrib / a[1].count)[0]
  const bestChamp = bestContribChamp
    ? { name: bestContribChamp[0], avgContrib: Math.round(bestContribChamp[1].totalContrib / bestContribChamp[1].count) }
    : null

  // Core stats per game
  const avgDmg    = entries.reduce((a, { r }) => a + r.damage_dealt, 0) / total
  const avgTaken  = entries.reduce((a, { r }) => a + r.damage_taken, 0) / total
  const avgHeal   = entries.reduce((a, { r }) => a + r.healing, 0) / total
  const avgCC     = entries.reduce((a, { r }) => a + r.cc_score, 0) / total
  const avgAssist = entries.reduce((a, { r }) => a + r.assists, 0) / total
  const avgDeath  = entries.reduce((a, { r }) => a + r.deaths, 0) / total
  const avgContrib= entries.reduce((a, { r }) => a + r.contribution_score, 0) / total

  // 1. 팀기여 점수 (0-100 normalized by team avg)
  const teamScore = Math.round((avgAssist * 1.2 + avgCC / 10 + avgHeal / 200) / 10)

  // 2. 생존 효율 = 기여도 / (데스 + 1)
  const surviveEff = Math.round((avgContrib / (avgDeath + 1)) * 10) / 10

  // 3. 성장 트렌드: 최근 20경기 vs 전체 평균
  const recent = entries.slice(0, Math.min(20, total))
  const recentAvg = recent.reduce((a, { r }) => a + r.contribution_score, 0) / recent.length
  const trend = Math.round((recentAvg - avgContrib) * 10) / 10

  return {
    mostChamp, champWinRate, champCount: mostInfo.count, role,
    bestChamp,
    avgDmg, avgTaken, avgHeal, avgCC,
    teamScore, surviveEff, trend,
    total,
  }
}

// ─── Player Profile Card ──────────────────────────────────────────────────────

interface PlayerSummary { id: string; puuid: string; game_name: string; tag_line: string }

function PlayerProfileCard({ player, allGames, champRoles }: {
  player: PlayerSummary; allGames: Game[]; champRoles: ChampRoleMap
}) {
  const stats = useMemo(
    () => computePlayerStats(player.puuid, allGames, champRoles),
    [player.puuid, allGames, champRoles]
  )
  if (!stats) return null

  const trendPositive = stats.trend > 0

  return (
    <div className="bg-gray-800/60 rounded-2xl p-4 border border-gray-700 flex flex-col gap-3 h-full hover:border-purple-600/50 transition-colors">
      {/* Header */}
      <div>
        <div className="font-bold text-white text-sm leading-tight">{player.game_name}</div>
        <div className="text-xs text-gray-500">#{player.tag_line}</div>
      </div>

      {/* Most champ + Best contrib champ */}
      <div className="flex gap-2">
        {/* 모스트 */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <ChampionIcon name={stats.mostChamp} size={32} />
          <div className="min-w-0">
            <div className="text-xs text-gray-500">모스트</div>
            <div className="text-xs font-semibold text-yellow-400 truncate">{stats.mostChamp}</div>
            <div className="text-xs text-gray-500">{stats.champCount}판·{stats.champWinRate}%</div>
          </div>
        </div>
        {/* 기여도 최고 챔피언 */}
        {stats.bestChamp && stats.bestChamp.name !== stats.mostChamp && (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <ChampionIcon name={stats.bestChamp.name} size={32} />
            <div className="min-w-0">
              <div className="text-xs text-gray-500">기여도 1위</div>
              <div className="text-xs font-semibold text-purple-400 truncate">{stats.bestChamp.name}</div>
              <div className="text-xs text-gray-500">평균 {stats.bestChamp.avgContrib}점</div>
            </div>
          </div>
        )}
      </div>

      {/* Role tag */}
      <div className="flex flex-wrap gap-1">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
          {stats.role.emoji} {stats.role.label}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${trendPositive ? 'bg-green-900/60 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
          {trendPositive ? '📈' : '📊'} {trendPositive ? '+' : ''}{stats.trend}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-auto">
        <div className="flex justify-between">
          <span className="text-gray-500">팀기여</span>
          <span className="text-blue-400 font-semibold">{stats.teamScore}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">생존효율</span>
          <span className="text-purple-400 font-semibold">{stats.surviveEff}</span>
        </div>
      </div>
    </div>
  )
}

// ─── MVP Card ─────────────────────────────────────────────────────────────────

function MvpCard({ games }: { games: Game[] }) {
  if (!games.length) return null
  let mvpResult: GameResult | null = null
  for (const game of games)
    for (const r of game.game_results)
      if (r.players && (!mvpResult || r.contribution_score > mvpResult.contribution_score))
        mvpResult = r
  if (!mvpResult) return null

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
  for (const m of medals)
    for (const w of m.winners) {
      if (!resultMedals[w.id]) resultMedals[w.id] = []
      resultMedals[w.id].push(m)
    }

  const sorted = [...game.game_results]
    .filter((r: GameResult) => r.players)
    .sort((a: GameResult, b: GameResult) => b.contribution_score - a.contribution_score)
  const mvp = sorted[0]
  const wins = game.our_team_win

  return (
    <div className={`rounded-xl border overflow-hidden ${wins ? 'border-green-800/60' : 'border-red-900/60'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${wins ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
          {wins ? 'WIN' : 'LOSS'}
        </span>
        <span className="text-gray-500 text-xs shrink-0">{formatDuration(game.duration_seconds)}</span>
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
        <span className={`shrink-0 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

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

// ─── Daily Performance vs Baseline ───────────────────────────────────────────

function DailyPerformance({ allGames, filteredGames, players }: {
  allGames: Game[]
  filteredGames: Game[]
  players: PlayerSummary[]
}) {
  if (!filteredGames.length) return null

  const stats = players.map(p => {
    // 전체 평균 기여도
    const allResults = allGames.flatMap(g =>
      g.game_results.filter(r => r.players?.puuid === p.puuid)
    )
    if (!allResults.length) return null
    const baseline = allResults.reduce((a, r) => a + r.contribution_score, 0) / allResults.length

    // 오늘 평균 기여도
    const todayResults = filteredGames.flatMap(g =>
      g.game_results.filter(r => r.players?.puuid === p.puuid)
    )
    if (!todayResults.length) return null
    const todayAvg = todayResults.reduce((a, r) => a + r.contribution_score, 0) / todayResults.length

    const diff = todayAvg - baseline
    const diffPct = Math.round((diff / baseline) * 100)

    return { name: p.game_name, baseline: Math.round(baseline * 10) / 10, todayAvg: Math.round(todayAvg * 10) / 10, diff: Math.round(diff * 10) / 10, diffPct }
  }).filter(Boolean) as { name: string; baseline: number; todayAvg: number; diff: number; diffPct: number }[]

  if (!stats.length) return null

  const sorted = [...stats].sort((a, b) => b.diff - a.diff)
  const topCarry = sorted[0]
  const topAnchor = sorted[sorted.length - 1]

  return (
    <div className="bg-gray-800/60 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-300">📊 오늘의 평균 대비 성과</span>
        <span className="text-xs text-gray-500">평소 기여도 기준</span>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 border-b border-gray-700">
        <div className="px-4 py-3 border-r border-gray-700">
          <div className="text-xs text-gray-500 mb-1">오늘의 캐리</div>
          <div className="flex items-center gap-1.5">
            <span className="text-green-400 text-lg font-bold">🔥</span>
            <div>
              <div className="text-sm font-bold text-green-400">{topCarry.name}</div>
              <div className="text-xs text-gray-400">
                평소 {topCarry.baseline} → 오늘 {topCarry.todayAvg}
                <span className="ml-1 text-green-400 font-semibold">({topCarry.diff >= 0 ? '+' : ''}{topCarry.diff})</span>
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">오늘의 발목</div>
          <div className="flex items-center gap-1.5">
            <span className="text-red-400 text-lg font-bold">🧊</span>
            <div>
              <div className="text-sm font-bold text-red-400">{topAnchor.name}</div>
              <div className="text-xs text-gray-400">
                평소 {topAnchor.baseline} → 오늘 {topAnchor.todayAvg}
                <span className="ml-1 text-red-400 font-semibold">({topAnchor.diff >= 0 ? '+' : ''}{topAnchor.diff})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-player bars */}
      <div className="px-4 py-3 space-y-2.5">
        {sorted.map(p => {
          const isPositive = p.diff >= 0
          const barPct = Math.min(Math.abs(p.diffPct), 100)
          return (
            <div key={p.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-300 font-medium">{p.name}</span>
                <span className={isPositive ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                  {isPositive ? '+' : ''}{p.diff} ({isPositive ? '+' : ''}{p.diffPct}%)
                </span>
              </div>
              {/* Bar: center = baseline, extends left (bad) or right (good) */}
              <div className="relative h-1.5 bg-gray-700 rounded-full">
                <div
                  className={`absolute top-0 h-full rounded-full ${isPositive ? 'bg-green-500 left-1/2' : 'bg-red-500 right-1/2'}`}
                  style={{ width: `${barPct / 2}%` }}
                />
                {/* Center line */}
                <div className="absolute left-1/2 top-0 h-full w-px bg-gray-500" />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                <span>평소 {p.baseline}</span>
                <span>오늘 {p.todayAvg}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DateNavigator({ selectedDate, availableDates, onChange }: {
  selectedDate: string; availableDates: Set<string>; onChange: (d: string) => void
}) {
  const sorted = useMemo(() => [...availableDates].sort(), [availableDates])
  const idx = sorted.indexOf(selectedDate)
  const pickerRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => idx > 0 && onChange(sorted[idx - 1])} disabled={idx <= 0}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg">‹</button>
      <div className="relative">
        <button onClick={() => setTimeout(() => pickerRef.current?.showPicker?.(), 0)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:border-purple-500 text-white font-medium text-sm transition-all">
          <span>📅</span><span>{formatDisplayDate(selectedDate)}</span>
        </button>
        <input ref={pickerRef} type="date" value={selectedDate}
          onChange={e => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer" />
      </div>
      <button onClick={() => idx < sorted.length - 1 && onChange(sorted[idx + 1])} disabled={idx >= sorted.length - 1}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg">›</button>
      {idx >= 0 && <span className="text-xs text-gray-500 hidden sm:block">{idx + 1} / {sorted.length}일</span>}
    </div>
  )
}

// ─── Hall of Fame ─────────────────────────────────────────────────────────────

function HallOfFame({ nicknames }: { nicknames: NicknameAward[] }) {
  if (!nicknames.length) return <p className="text-gray-500 text-center py-6 text-sm">게임을 더 싱크해주세요.</p>
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

// ─── Badge Leaderboard (카드형) ───────────────────────────────────────────────

const BADGE_DEFS = [
  { id: 'mvp',     emoji: '👑', name: 'MVP',    desc: '최고 기여도' },
  { id: 'dealer',  emoji: '⚔️',  name: '딜장인', desc: '최고 딜량' },
  { id: 'gold',    emoji: '💰', name: '골드왕', desc: '최다 골드' },
  { id: 'healer',  emoji: '💊', name: '힐봇',   desc: '최고 힐량' },
  { id: 'tank',    emoji: '🛡️', name: '방패',   desc: '피해흡수 1위' },
  { id: 'killer',  emoji: '🎯', name: '킬머신', desc: '최다 킬' },
  { id: 'assist',  emoji: '🤝', name: '어시왕', desc: '최다 어시' },
  { id: 'death',   emoji: '💀', name: '죽어줘', desc: '최다 데스' },
  { id: 'passive', emoji: '🐔', name: '꽁꽁이', desc: '최저 CC' },
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

function BadgeLeaderboard({ games, players }: { games: Game[]; players: PlayerSummary[] }) {
  const lb = useMemo(() => buildBadgeCounts(games), [games])

  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
      {BADGE_DEFS.map(badge => {
        // 이 뱃지 1위 플레이어
        const ranked = players
          .map(p => ({ name: p.game_name, count: lb[p.game_name]?.[badge.id] ?? 0 }))
          .sort((a, b) => b.count - a.count)
        const top = ranked[0]

        return (
          <div key={badge.id} className="bg-gray-800/60 rounded-xl p-3 border border-gray-700 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">{badge.emoji}</span>
              <div>
                <div className="text-xs font-bold text-gray-200">{badge.name}</div>
                <div className="text-xs text-gray-500">{badge.desc}</div>
              </div>
            </div>
            <div className="border-t border-gray-700 pt-1.5">
              {ranked.map((p, i) => (
                <div key={p.name} className={`flex justify-between items-center text-xs py-0.5 ${i === 0 && p.count > 0 ? 'text-yellow-400 font-bold' : 'text-gray-400'}`}>
                  <span className="truncate">{i === 0 && p.count > 0 ? '🥇 ' : ''}{p.name.split(' ')[0]}</span>
                  <span>{p.count || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  allGames: Game[]
  players: PlayerSummary[]
  initialNicknames: NicknameAward[]
  champRoles: ChampRoleMap
}

export default function DashboardClient({ allGames, players, initialNicknames, champRoles }: Props) {
  const availableDates = useMemo(() => {
    const s = new Set<string>()
    for (const g of allGames) s.add(toKSTDateString(g.played_at))
    return s
  }, [allGames])

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const dates = allGames.map(g => toKSTDateString(g.played_at)).sort()
    return dates[dates.length - 1] ?? todayKST()
  })

  useEffect(() => {
    const dates = allGames.map(g => toKSTDateString(g.played_at)).sort()
    setSelectedDate(dates[dates.length - 1] ?? todayKST())
  }, [allGames])

  const [animKey, setAnimKey] = useState(0)
  const handleDateChange = (d: string) => { setSelectedDate(d); setAnimKey(k => k + 1) }

  const filteredGames = useMemo(
    () => allGames.filter(g => toKSTDateString(g.played_at) === selectedDate),
    [allGames, selectedDate]
  )

  const orderedPlayers = useMemo(() => [...players].sort((a, b) => {
    const ai = TRACKED_PLAYERS.findIndex(p => p.puuid === a.puuid)
    const bi = TRACKED_PLAYERS.findIndex(p => p.puuid === b.puuid)
    return ai - bi
  }), [players])

  return (
    <div className="space-y-6">

      {/* ── 플레이어 프로필 (고정) ── */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {orderedPlayers.map(p => (
            <Link key={p.puuid} href={`/players/${encodeURIComponent(p.puuid)}`} className="block">
              <PlayerProfileCard player={p} allGames={allGames} champRoles={champRoles} />
            </Link>
          ))}
        </div>
      </section>

      {/* ── 날짜 탐색 ── */}
      <DateNavigator selectedDate={selectedDate} availableDates={availableDates} onChange={handleDateChange} />

      {/* ── 날짜별 콘텐츠 ── */}
      <div key={animKey} className="space-y-4" style={{ animation: 'fadeSlideIn 0.25s ease-out' }}>
        {filteredGames.length > 0 && <MvpCard games={filteredGames} />}
        {filteredGames.length > 0 && (
          <DailyPerformance allGames={allGames} filteredGames={filteredGames} players={orderedPlayers} />
        )}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold text-gray-300">당일 게임</h2>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">{filteredGames.length}경기</span>
          </div>
          {filteredGames.length === 0
            ? <p className="text-gray-500 text-center py-8 text-sm">해당 날짜에 기록된 게임이 없습니다</p>
            : <div className="space-y-2">{filteredGames.map(g => <GameRow key={g.id} game={g} />)}</div>
          }
        </section>
      </div>

      {/* ── 명예의 전당 ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-gray-300">🏛️ 명예의 전당</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">전체 누적</span>
        </div>
        <HallOfFame nicknames={initialNicknames} />
      </section>

      {/* ── 뱃지 리더보드 ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-gray-300">🏅 뱃지 리더보드</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">전체 기록</span>
        </div>
        <BadgeLeaderboard games={allGames} players={orderedPlayers} />
      </section>

    </div>
  )
}
