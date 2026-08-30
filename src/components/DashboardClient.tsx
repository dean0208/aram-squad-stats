'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Game, GameResult } from '@/lib/types'
import type { NicknameAward } from '@/lib/nicknames'
import { calculateMedals } from '@/lib/medals'
import { getPlayerDisplayName, TRACKED_PLAYERS, DDRAGON_VERSION } from '@/lib/config'
import { getChampionDisplayName, type ChampionNameMap } from '@/lib/championNames'
import { rankContributionChampions } from '@/lib/championStats'
import { getGrowthStatus } from '@/lib/growth'
import { selectMvp } from '@/lib/mvp'
import { toDisplayContributionScore } from '@/lib/displayScore'
import { assignPlayerTitles, type PlayerTitle } from '@/lib/playerTitles'
import { getAugmentHighlight, getAugmentName } from '@/lib/augmentHighlight'
import { getGameCommentary } from '@/lib/gameCommentary'
import { analyzeTeamComposition, getBestChampionComposition, getBestRoleByPlayer, getWorstRoleByPlayer, type DamageType } from '@/lib/teamInsights'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
function formatStartTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
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

type ChampRoleMap = Record<string, { label: string; emoji: string; damageType?: DamageType }>

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
  const avgDamage = entries.reduce((a, { r }) => a + r.damage_dealt, 0) / total
  const avgTaken = entries.reduce((a, { r }) => a + r.damage_taken, 0) / total
  const avgHealing = entries.reduce((a, { r }) => a + r.healing, 0) / total
  const avgCc = entries.reduce((a, { r }) => a + r.cc_score, 0) / total
  const avgAssist = entries.reduce((a, { r }) => a + r.assists, 0) / total
  const recent10 = entries.slice(0, Math.min(10, total))
  const recent10AvgContrib = recent10.reduce((a, { r }) => a + r.contribution_score, 0) / recent10.length
  const growthStatus = getGrowthStatus(avgContrib, recent10AvgContrib)

  return {
    mostChamp, champWinRate, champCount: mostInfo.count, role,
    bestChamp, worstChamp,
    avgContrib: Math.round(avgContrib), avgDeath, growthStatus,
    avgDamage, avgTaken, avgHealing, avgCc, avgAssist,
    total,
  }
}

// ─── Player Profile Card ──────────────────────────────────────────────────────

interface PlayerSummary { id: string; puuid: string; game_name: string; tag_line: string }

function PlayerProfileCard({ player, allGames, champRoles, title }: {
  player: PlayerSummary; allGames: Game[]; champRoles: ChampRoleMap; title: PlayerTitle
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
    <div className="bg-gray-800/60 rounded-2xl p-3 sm:p-4 border border-gray-700 flex flex-col gap-2 h-full cursor-pointer touch-manipulation hover:border-purple-600/50 hover:shadow-lg hover:shadow-blue-100/60 transition-all">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="font-bold text-white text-base leading-tight">{getPlayerDisplayName(player.puuid, player.game_name)}</div>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-semibold leading-tight text-blue-600">
            {title.emoji} {title.label}
          </span>
        </div>
        <div className="text-sm text-gray-500">#{player.tag_line}</div>
      </div>

      {/* Champion highlights: stacked rows stay readable in narrow cards */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-yellow-900/40 bg-yellow-950/20 px-2 py-1">
          <ChampionIcon name={stats.mostChamp} size={32} />
          <div className="min-w-0">
            <div className="text-sm leading-tight text-gray-500">모스트</div>
          </div>
          <div className="text-right text-sm leading-tight text-gray-400">
            <div>{stats.champCount}판</div>
            <div className="font-semibold text-yellow-300">승률 {stats.champWinRate}%</div>
          </div>
        </div>

        {stats.bestChamp && (
          <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-purple-900/40 bg-purple-950/20 px-2 py-1">
            <ChampionIcon name={stats.bestChamp.name} size={32} />
            <div className="min-w-0">
              <div className="text-sm leading-tight text-gray-500">기여도 👍</div>
            </div>
            <div className="whitespace-nowrap text-right text-sm text-gray-400">
              평균 <span className="font-semibold text-purple-300">{toDisplayContributionScore(stats.bestChamp.avgContribution)}점</span>
            </div>
          </div>
        )}

        {stats.worstChamp && (
          <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-2 py-1">
            <ChampionIcon name={stats.worstChamp.name} size={32} />
            <div className="min-w-0">
              <div className="text-sm leading-tight text-gray-500">기여도 👎</div>
            </div>
            <div className="whitespace-nowrap text-right text-sm text-gray-400">
              평균 <span className="font-semibold text-red-300">{toDisplayContributionScore(stats.worstChamp.avgContribution)}점</span>
            </div>
          </div>
        )}
      </div>

      {/* Role tag */}
      <div className="flex flex-wrap gap-1">
        <span className="text-sm px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
          최근 10경기
        </span>
        <span
          className={`text-sm px-2 py-0.5 rounded-full ${growthStatusUi.className}`}
          title="전체 게임 평균 기여도 대비 최근 10게임 성장세"
        >
          {growthStatusUi.icon} {stats.growthStatus}
        </span>
      </div>

      {/* Average contribution: keep the only numeric summary compact */}
      <div className="min-w-0 rounded-lg bg-gray-900/50 px-2 py-1 mt-auto">
        <div className="text-sm leading-tight text-gray-500">평균 기여도</div>
        <div className="text-base font-semibold text-blue-400">{toDisplayContributionScore(stats.avgContrib)}점</div>
      </div>
      <div className="flex items-center justify-between text-sm font-medium text-blue-500">
        <span>상세 프로필</span>
        <span aria-hidden="true">→</span>
      </div>
    </div>
  )
}

// ─── MVP Card ─────────────────────────────────────────────────────────────────

function MvpCard({ games, championNames }: { games: Game[]; championNames: ChampionNameMap }) {
  if (!games.length) return null
  const mvpResult = selectMvp(
    games.flatMap(game => game.game_results).filter(result => result.players),
  )
  if (!mvpResult) return null

  return (
    <div className="bg-gradient-to-r from-amber-950 to-yellow-950 border border-amber-700 rounded-2xl p-4 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
      <div className="text-3xl">👑</div>
      <div className="flex min-w-0 flex-col items-center gap-1.5">
        <ChampionIcon name={mvpResult.champion_name} size={44} />
        <div className="min-w-0">
          <div className="text-sm text-amber-400 font-semibold uppercase tracking-wider">오늘의 MVP</div>
          <div className="text-white font-bold text-xl leading-tight">{mvpResult.players ? getPlayerDisplayName(mvpResult.players.puuid, mvpResult.players.game_name) : '—'}</div>
          <div className="text-base text-amber-300">{getChampionDisplayName(mvpResult.champion_name, championNames)} · {mvpResult.kills}/{mvpResult.deaths}/{mvpResult.assists}</div>
        </div>
      </div>
      <div className="shrink-0 text-center">
        <div className="text-3xl font-black text-amber-300">{toDisplayContributionScore(mvpResult.perf_score)}</div>
        <div className="text-sm text-amber-500">기여도 지수 / 100</div>
      </div>
    </div>
  )
}

function DailyAugmentCard({ games }: { games: Game[] }) {
  const highlight = getAugmentHighlight(
    games.flatMap(game =>
      game.game_results
        .filter(result => result.players && result.augment_ids?.length)
        .map(result => ({
          our_team_win: game.our_team_win,
          augment_ids: result.augment_ids,
        })),
    ),
  )
  if (!highlight) return null

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
      <div className="text-sm font-semibold text-blue-500">✨ 오늘의 증강</div>
      <div className="mt-1 text-lg font-bold text-blue-700">{getAugmentName(highlight.id)}</div>
      <div className="mt-0.5 text-sm text-blue-600">
        {highlight.wins === highlight.games ? '승리한 판에서 가장 빛난 픽' : '오늘 승패에 가장 큰 영향을 준 픽'}
      </div>
    </div>
  )
}

// ─── Collapsible Game Row ──────────────────────────────────────────────────────

function GameRow({ game, champRoles }: { game: Game; champRoles: ChampRoleMap }) {
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
  const commentary = getGameCommentary({
    game_id: game.id,
    our_team_win: game.our_team_win,
    game_results: game.game_results
      .filter(result => result.players)
      .map(result => ({
        name: getPlayerDisplayName(result.players!.puuid, result.players!.game_name),
        contribution_score: result.contribution_score,
        damage_dealt: result.damage_dealt,
        damage_taken: result.damage_taken,
        healing: result.healing,
        assists: result.assists,
        cc_score: result.cc_score,
      })),
  })
  const compositionInsights = analyzeTeamComposition({
    win: game.our_team_win,
    members: game.game_results.filter(result => result.players).map(result => ({
      championName: result.champion_name,
      damageType: champRoles[result.champion_name]?.damageType ?? 'Utility',
    })),
  })
  const hasPartialData = game.game_results.filter(result => result.players).length < 4

  return (
    <div className={`rounded-xl border overflow-hidden ${wins ? 'border-green-800/60' : 'border-red-900/60'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`${formatDuration(game.duration_seconds)} 게임 상세 ${open ? '접기' : '보기'}`}
        className="w-full flex flex-wrap items-center gap-3 p-3 sm:p-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${wins ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
          {wins ? 'WIN' : 'LOSS'}
        </span>
        <span className="text-gray-500 text-xs shrink-0">{formatStartTime(game.played_at)}</span>
        <span className="text-gray-500 text-xs shrink-0">{formatDuration(game.duration_seconds)}</span>
        {hasPartialData && <span className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700">일부 지표 누락</span>}
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
        <span className={`basis-full order-last text-xs ${wins ? 'text-green-600' : 'text-red-600'}`}>
          💬 {commentary}
        </span>
        <span className="basis-full order-last text-xs text-gray-500">
          🧩 {compositionInsights.join(' ')}
        </span>
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

function BestCompositionCard({ games, championNames }: { games: Game[]; championNames: ChampionNameMap }) {
  const best = getBestChampionComposition(games.map(game => ({
    win: game.our_team_win,
    members: game.game_results.filter(result => result.players).map(result => ({
      playerId: result.players!.puuid,
      championName: result.champion_name,
    })),
  })))
  if (!best) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4">
        <div className="text-sm font-semibold text-indigo-700">🤝 가장 승률이 높았던 4인 조합</div>
        <p className="mt-2 text-sm text-indigo-600">같은 4인 조합으로 3경기 이상 플레이한 기록이 아직 없어요.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4">
      <div className="text-sm font-semibold text-indigo-700">🤝 가장 승률이 높았던 4인 조합</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {best.champions.map(champion => (
          <div key={champion} className="flex w-16 flex-col items-center gap-1 text-center">
            <ChampionIcon name={champion} size={40} />
            <span className="text-xs font-medium leading-tight text-indigo-950">{getChampionDisplayName(champion, championNames)}</span>
          </div>
        ))}
        <div className="ml-auto text-right">
          <div className="text-2xl font-black text-indigo-700">{best.winRate}%</div>
          <div className="text-xs text-indigo-600">{best.wins}승 {best.games - best.wins}패 · {best.games}경기</div>
        </div>
      </div>
    </div>
  )
}

function BestRoleCard({ games, players, champRoles }: { games: Game[]; players: PlayerSummary[]; champRoles: ChampRoleMap }) {
  const bestByPlayer = getBestRoleByPlayer(games.map(game => ({
    win: game.our_team_win,
    members: game.game_results.filter(result => result.players).map(result => ({
      playerId: result.players!.puuid,
      role: champRoles[result.champion_name]?.label ?? '올라운더',
    })),
  })))
  const worstByPlayer = getWorstRoleByPlayer(games.map(game => ({
    win: game.our_team_win,
    members: game.game_results.filter(result => result.players).map(result => ({
      playerId: result.players!.puuid,
      role: champRoles[result.champion_name]?.label ?? '올라운더',
    })),
  })))
  const rows = players.map(player => ({
    name: getPlayerDisplayName(player.puuid, player.game_name),
    best: bestByPlayer.get(player.puuid),
  })).filter(row => row.best)
  const worstRows = players.map(player => ({
    name: getPlayerDisplayName(player.puuid, player.game_name),
    worst: worstByPlayer.get(player.puuid),
  })).filter(row => row.worst)
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
        <div className="text-sm font-semibold text-emerald-700">🎯 플레이어별 최고 팀 승률 포지션</div>
        <p className="mt-2 text-sm text-emerald-600">포지션별 10경기 이상 기록이 쌓이면 신뢰도 높은 승률을 보여드릴게요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
        <div className="text-sm font-semibold text-emerald-700">🎯 플레이어별 최고 팀 승률 포지션</div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.map(({ name, best }) => (
            <div key={name} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
              <span className="text-sm font-semibold text-emerald-950">{name}</span>
              <span className="text-sm text-emerald-700"><b>{best!.role}</b> 잡을 때 {best!.winRate}% <span className="text-xs">({best!.games}경기)</span></span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
        <div className="text-sm font-semibold text-rose-700">📉 플레이어별 승률이 아쉬웠던 포지션</div>
        {worstRows.length ? (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {worstRows.map(({ name, worst }) => (
              <div key={name} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                <span className="text-sm font-semibold text-rose-950">{name}</span>
                <span className="text-sm text-rose-700"><b>{worst!.role}</b> 잡을 때 {worst!.winRate}% <span className="text-xs">({worst!.games}경기)</span></span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-rose-600">포지션별 10경기 이상 기록이 쌓이면 아쉬웠던 역할도 보여드릴게요.</p>
        )}
      </div>
    </>
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
      <div className="px-4 py-3 border-b border-gray-700 text-center">
        <div className="text-sm font-semibold text-gray-300">📊 오늘은 누가 좀 치싸뿌노</div>
        <div className="text-xs text-gray-500 mt-0.5">전체 평균과 비교한 오늘의 상승·하락세</div>
      </div>

      {/* Two intuitive highlights, without score clutter */}
      <div className="grid grid-cols-2 divide-x divide-gray-700 text-center">
        <div className="flex flex-col items-center p-4">
          <div className="text-xs text-gray-500 mb-2">임마 좀 치네</div>
          <div className="text-2xl mb-1">🔥</div>
          <div className="text-sm font-bold text-green-400 truncate" title={topCarry.name}>{topCarry.name}</div>
          <div className="text-xs text-green-300 mt-1">{topCarry.diff >= 0 ? '뜨급다 뜨거워' : '오늘 가장 선방'}</div>
        </div>
        <div className="flex flex-col items-center p-4">
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
  const latestDate = sorted[sorted.length - 1]
  const pickerRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => idx > 0 && onChange(sorted[idx - 1])} disabled={idx <= 0}
        aria-label="이전 날짜" className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg">‹</button>
      <div className="relative">
        <button onClick={() => setTimeout(() => pickerRef.current?.showPicker?.(), 0)} aria-label="날짜 선택"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:border-purple-500 text-white font-medium text-sm transition-all">
          <span>📅</span><span>{formatDisplayDate(selectedDate)}</span>
        </button>
        <input ref={pickerRef} type="date" value={selectedDate}
          onChange={e => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer" />
      </div>
      <button onClick={() => idx < sorted.length - 1 && onChange(sorted[idx + 1])} disabled={idx >= sorted.length - 1}
        aria-label="다음 날짜" className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg">›</button>
      <button onClick={() => latestDate && onChange(latestDate)} disabled={!latestDate || selectedDate === latestDate}
        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40">최신</button>
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
        <div key={award.id} className={`toss-hall-card toss-hall-${award.borderColor.replace('border-', '').replace('-700', '')} bg-gradient-to-br ${award.color} rounded-xl p-3 border ${award.borderColor}`}>
          <div className="text-2xl mb-1">{award.emoji}</div>
          <div className={`text-xs font-bold break-words leading-tight ${award.textColor}`}>{award.name}</div>
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
  championNames: ChampionNameMap
}

export default function DashboardClient({ allGames, players, initialNicknames, champRoles, championNames }: Props) {
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
    const timer = window.setTimeout(() => setSelectedDate(dates[dates.length - 1] ?? todayKST()), 0)
    return () => window.clearTimeout(timer)
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

  const playerTitles = useMemo(() => {
    const titleStats = orderedPlayers.flatMap(player => {
      const stats = computePlayerStats(player.puuid, allGames, champRoles)
      if (!stats) return []
      return [{
        puuid: player.puuid,
        role: stats.role.label,
        avgDamage: stats.avgDamage,
        avgTaken: stats.avgTaken,
        avgHealing: stats.avgHealing,
        avgCc: stats.avgCc,
        avgAssist: stats.avgAssist,
      }]
    })
    return assignPlayerTitles(titleStats)
  }, [orderedPlayers, allGames, champRoles])

  return (
    <div className="space-y-6">

      {/* ── 플레이어 프로필 (고정) ── */}
      <section id="players">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {orderedPlayers.map(p => (
            <Link
              key={p.puuid}
              href={`/players/${encodeURIComponent(p.puuid)}`}
              prefetch
              className="group block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
              aria-label={`${getPlayerDisplayName(p.puuid, p.game_name)} 상세 프로필 보기`}
            >
              <PlayerProfileCard
                player={p}
                allGames={allGames}
                champRoles={champRoles}
                title={playerTitles.get(p.puuid) ?? { emoji: '⚡', label: '든든한 전력' }}
              />
            </Link>
          ))}
        </div>
      </section>

      {/* ── 날짜 탐색 ── */}
      <DateNavigator selectedDate={selectedDate} availableDates={availableDates} onChange={handleDateChange} />

      {/* ── 날짜별 콘텐츠 ── */}
      <div key={animKey} className="space-y-4" style={{ animation: 'fadeSlideIn 0.25s ease-out' }}>
        {filteredGames.length > 0 && <MvpCard games={filteredGames} championNames={championNames} />}
        {filteredGames.length > 0 && <DailyAugmentCard games={filteredGames} />}
        {filteredGames.length > 0 && (
          <DailyPerformance allGames={allGames} filteredGames={filteredGames} players={orderedPlayers} />
        )}
        <section id="matches">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold text-gray-300">당일 게임</h2>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">{filteredGames.length > 5 ? `최신 5 / ${filteredGames.length}경기` : `${filteredGames.length}경기`}</span>
          </div>
          {filteredGames.length === 0
            ? <p className="text-gray-500 text-center py-8 text-sm">해당 날짜에 기록된 게임이 없습니다</p>
            : <div className="space-y-2">{filteredGames.slice(0, 5).map(g => <GameRow key={g.id} game={g} champRoles={champRoles} />)}</div>
          }
        </section>
        <BestCompositionCard games={allGames} championNames={championNames} />
        <BestRoleCard games={allGames} players={orderedPlayers} champRoles={champRoles} />
      </div>

      {/* ── 명예의 전당 ── */}
      <section id="records">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [&::-webkit-details-marker]:hidden">
            <h2 className="text-base font-semibold text-gray-300">🏛️ 마일스톤</h2>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">역대 기록</span>
            <span className="ml-auto text-sm text-gray-500 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <div className="mt-3"><HallOfFame nicknames={initialNicknames} /></div>
        </details>
      </section>

      {/* ── 뱃지 리더보드 ── */}
      <section>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [&::-webkit-details-marker]:hidden">
            <h2 className="text-base font-semibold text-gray-300">🏅 메달리스트</h2>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">누가 제일 많이 모았나</span>
            <span className="ml-auto text-sm text-gray-500 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <div className="mt-3"><BadgeLeaderboard games={allGames} players={orderedPlayers} /></div>
        </details>
      </section>

    </div>
  )
}
