'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Game, GameResult } from '@/lib/types'
import type { NicknameAward } from '@/lib/nicknames'
import { calculateMedals } from '@/lib/medals'
import { getPlayerDisplayName, TRACKED_PLAYERS, DDRAGON_VERSION } from '@/lib/config'
import { rankContributionChampions } from '@/lib/championStats'
import { getGrowthStatus } from '@/lib/growth'
import { selectMvp } from '@/lib/mvp'
import { toDisplayContributionScore } from '@/lib/displayScore'

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

  // Best/worst avg contribution champs (최소 3판 이상)
  const { best: bestChamp, worst: worstChamp } = rankContributionChampions(
    [...champData.entries()].map(([name, data]) => ({
      name,
      count: data.count,
      totalContribution: data.totalContrib,
    })),
  )

  // 전체 평균 대비 최근 10판 성장세
  const avgContrib = entries.reduce((a, { r }) => a + r.contribution_score, 0) / total
  const avgDeath = entries.reduce((a, { r }) => a + r.deaths, 0) / total
  const recent10 = entries.slice(0, Math.min(10, total))
  const recent10AvgContrib = recent10.reduce((a, { r }) => a + r.contribution_score, 0) / recent10.length
  const growthStatus = getGrowthStatus(avgContrib, recent10AvgContrib)

  return {
    mostChamp, champWinRate, champCount: mostInfo.count, role,
    bestChamp, worstChamp,
    avgContrib: Math.round(avgContrib), avgDeath, growthStatus,
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

  const growthStatusUi = {
    폼다죽: { icon: '📉', className: 'bg-red-950/70 text-red-300' },
    아쉬워: { icon: '😅', className: 'bg-orange-950/70 text-orange-300' },
    '좋은데?': { icon: '👍', className: 'bg-blue-950/70 text-blue-300' },
    버스기사님: { icon: '🚌', className: 'bg-green-950/70 text-green-300' },
  }[stats.growthStatus]

  return (
    <div className="bg-gray-800/60 rounded-2xl p-3 sm:p-4 border border-gray-700 flex flex-col gap-2 h-full hover:border-purple-600/50 transition-colors">
      {/* Header */}
      <div>
        <div className="font-bold text-white text-sm leading-tight">{getPlayerDisplayName(player.puuid, player.game_name)}</div>
        <div className="text-xs text-gray-500">#{player.tag_line}</div>
      </div>

      {/* Champion highlights: stacked rows stay readable in narrow cards */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-yellow-900/40 bg-yellow-950/20 px-2 py-1">
          <ChampionIcon name={stats.mostChamp} size={32} />
          <div className="min-w-0">
            <div className="text-xs leading-tight text-gray-500">모스트</div>
          </div>
          <div className="text-right text-xs leading-tight text-gray-400">
            <div>{stats.champCount}판</div>
            <div className="font-semibold text-yellow-300">승률 {stats.champWinRate}%</div>
          </div>
        </div>

        {stats.bestChamp && (
          <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-purple-900/40 bg-purple-950/20 px-2 py-1">
            <ChampionIcon name={stats.bestChamp.name} size={32} />
            <div className="min-w-0">
              <div className="text-xs leading-tight text-gray-500">기여도 👍</div>
            </div>
            <div className="whitespace-nowrap text-right text-xs text-gray-400">
              평균 <span className="font-semibold text-purple-300">{toDisplayContributionScore(stats.bestChamp.avgContribution)}점</span>
            </div>
          </div>
        )}

        {stats.worstChamp && (
          <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-2 py-1">
            <ChampionIcon name={stats.worstChamp.name} size={32} />
            <div className="min-w-0">
              <div className="text-xs leading-tight text-gray-500">기여도 👎</div>
            </div>
            <div className="whitespace-nowrap text-right text-xs text-gray-400">
              평균 <span className="font-semibold text-red-300">{toDisplayContributionScore(stats.worstChamp.avgContribution)}점</span>
            </div>
          </div>
        )}
      </div>

      {/* Role tag */}
      <div className="flex flex-wrap gap-1">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
          최근 10경기
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${growthStatusUi.className}`}
          title="전체 게임 평균 기여도 대비 최근 10게임 성장세"
        >
          {growthStatusUi.icon} {stats.growthStatus}
        </span>
      </div>

      {/* Average contribution: keep the only numeric summary compact */}
      <div className="min-w-0 rounded-lg bg-gray-900/50 px-2 py-1 mt-auto">
        <div className="text-xs leading-tight text-gray-500">평균 기여도</div>
        <div className="text-sm font-semibold text-blue-400">{toDisplayContributionScore(stats.avgContrib)}점</div>
      </div>
    </div>
  )
}

// ─── MVP Card ─────────────────────────────────────────────────────────────────

function MvpCard({ games }: { games: Game[] }) {
  if (!games.length) return null
  const mvpResult = selectMvp(
    games.flatMap(game => game.game_results).filter(result => result.players),
  )
  if (!mvpResult) return null

  return (
    <div className="bg-gradient-to-r from-amber-950 to-yellow-950 border border-amber-700 rounded-2xl p-4 flex items-center gap-4">
      <div className="text-3xl">👑</div>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <ChampionIcon name={mvpResult.champion_name} size={44} />
        <div className="min-w-0">
          <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">오늘의 MVP</div>
          <div className="text-white font-bold text-lg leading-tight">{mvpResult.players ? getPlayerDisplayName(mvpResult.players.puuid, mvpResult.players.game_name) : '—'}</div>
          <div className="text-sm text-amber-300">{mvpResult.champion_name} · {mvpResult.kills}/{mvpResult.deaths}/{mvpResult.assists}</div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-2xl font-black text-amber-300">{toDisplayContributionScore(mvpResult.perf_score)}</div>
        <div className="text-xs text-amber-500">기여도 지수 / 100</div>
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
              <span className="text-purple-400 font-semibold">{mvp.players ? getPlayerDisplayName(mvp.players.puuid, mvp.players.game_name) : '—'}</span>
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
                    <div className="text-xs text-gray-300 font-medium truncate">{result.players ? getPlayerDisplayName(result.players.puuid, result.players.game_name) : '—'}</div>
                    <div className="text-xs text-gray-500">{result.kills}/{result.deaths}/{result.assists}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs font-bold text-purple-400">{toDisplayContributionScore(result.contribution_score)}</span>
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
    return { name: getPlayerDisplayName(p.puuid, p.game_name), diff }
  }).filter(Boolean) as { name: string; diff: number }[]

  if (!stats.length) return null

  const sorted = [...stats].sort((a, b) => b.diff - a.diff)
  const topCarry = sorted[0]
  const topAnchor = sorted[sorted.length - 1]

  return (
    <div className="bg-gray-800/60 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="text-sm font-semibold text-gray-300">📊 오늘은 누가 좀 치싸뿌노</div>
        <div className="text-xs text-gray-500 mt-0.5">전체 평균과 비교한 오늘의 상승·하락세</div>
      </div>

      {/* Two intuitive highlights, without score clutter */}
      <div className="grid grid-cols-2 divide-x divide-gray-700">
        <div className="p-4">
          <div className="text-xs text-gray-500 mb-2">임마 좀 치네</div>
          <div className="text-2xl mb-1">🔥</div>
          <div className="text-sm font-bold text-green-400 truncate" title={topCarry.name}>{topCarry.name}</div>
          <div className="text-xs text-green-300 mt-1">{topCarry.diff >= 0 ? '뜨급다 뜨거워' : '오늘 가장 선방'}</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-gray-500 mb-2">임마 걸배이고</div>
          <div className="text-2xl mb-1">🧊</div>
          <div className="text-sm font-bold text-red-400 truncate" title={topAnchor.name}>{topAnchor.name}</div>
          <div className="text-xs text-red-300 mt-1">{topAnchor.diff < 0 ? '마 정신 안채리나' : '오늘은 조금 아쉬워요'}</div>
        </div>
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
        const name = getPlayerDisplayName(winners[0].players.puuid, winners[0].players.game_name)
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
          .map(p => {
            const name = getPlayerDisplayName(p.puuid, p.game_name)
            return { name, count: lb[name]?.[badge.id] ?? 0 }
          })
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
          <h2 className="text-base font-semibold text-gray-300">🏛️ 우리들의 레전드관</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">역대 기록</span>
        </div>
        <HallOfFame nicknames={initialNicknames} />
      </section>

      {/* ── 뱃지 리더보드 ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-gray-300">🏅 훈장 수집 랭킹</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">누가 제일 많이 모았나</span>
        </div>
        <BadgeLeaderboard games={allGames} players={orderedPlayers} />
      </section>

    </div>
  )
}
