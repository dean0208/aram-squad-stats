'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Game, Player } from '@/lib/types'
import type { ChampionNameMap, ChampionRoleLabelMap } from '@/lib/championNames'
import type { NicknameAward } from '@/lib/nicknames'
import { getPlayerDisplayName } from '@/lib/config'
import { MEDALS, calculateMedals } from '@/lib/medals'
import {
  CONTESTS,
  contestStandings,
  periodGames,
  type RecordPeriod,
} from '@/lib/experience'
import {
  getBestRoleByPlayer,
  getWorstRoleByPlayer,
  getBestChampionComposition,
} from '@/lib/teamInsights'
import { ChampionAvatar } from './GameUI'

export default function RecordRoom({
  games,
  date,
  players,
  nicknames,
  names,
  roles,
}: {
  games: Game[]
  date: string
  players: Player[]
  nicknames: NicknameAward[]
  names: ChampionNameMap
  roles: ChampionRoleLabelMap
}) {
  const [period, setPeriod] = useState<RecordPeriod>('week')
  const selected = useMemo(
    () => periodGames(games, date, period),
    [games, date, period],
  )
  const roleGames = selected.map((game) => ({
    win: game.our_team_win,
    members: game.game_results
      .filter((r) => r.players)
      .map((r) => ({
        playerId: r.players!.puuid,
        role: roles[r.champion_name]?.label ?? '올라운더',
      })),
  }))
  const bestRoles = getBestRoleByPlayer(roleGames)
  const worstRoles = getWorstRoleByPlayer(roleGames)
  const bestComp = getBestChampionComposition(
    selected.map((game) => ({
      win: game.our_team_win,
      members: game.game_results
        .filter((r) => r.players)
        .map((r) => ({
          playerId: r.players!.puuid,
          championName: r.champion_name,
        })),
    })),
  )
  const badgeCounts = new Map<string, Record<string, number>>()
  for (const game of selected)
    for (const { medal, winners } of calculateMedals(game.game_results)) {
      if (winners.length !== 1 || !winners[0].players) continue
      const puuid = winners[0].players.puuid
      const counts = badgeCounts.get(puuid) ?? {}
      counts[medal.id] = (counts[medal.id] ?? 0) + 1
      badgeCounts.set(puuid, counts)
    }
  return (
    <section id="records" className="record-room space-y-5">
      <div className="section-heading">
        <div>
          <p className="eyebrow">OUR HALL OF FAME</p>
          <h2>우리 기록, 다음 주인은?</h2>
        </div>
        <span className="pill">{selected.length}경기</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="segmented" aria-label="기록 집계 기간">
          {(
            [
              ['week', '이번 주'],
              ['month', '이번 달'],
              ['all', '전체'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              aria-pressed={period === key}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted text-xs">
          {period === 'all'
            ? `조회한 전체 ${games.length}경기 기준`
            : `${date}까지 · ${period === 'week' ? '월요일부터' : '1일부터'}`}
        </p>
      </div>
      {!selected.length ? (
        <p className="empty-state">
          이 기간에는 기록이 없어요. 다른 기간을 골라보세요.
        </p>
      ) : (
        <div className="contest-grid">
          {CONTESTS.map((contest) => {
            const ranked = contestStandings(selected, contest)
            const leader = ranked[0],
              challenger = ranked[1]
            if (!leader || leader.value <= 0) return null
            const tied = ranked.filter(
              (p) => Math.abs(p.value - leader.value) < 1e-8,
            )
            const gap = challenger ? leader.value - challenger.value : 0
            const number = (n: number) =>
              contest.average
                ? n.toFixed(1)
                : Math.round(n).toLocaleString('ko-KR')
            return (
              <article className="surface contest-card" key={contest.id}>
                <span className="text-2xl" aria-hidden="true">
                  {contest.emoji}
                </span>
                <h3>{contest.label}</h3>
                <p className="muted text-xs">
                  {contest.average ? '평균 기여도' : `누적 ${contest.unit}`} ·
                  공동 1위는 함께 표시
                </p>
                <p className="contest-winner">
                  {tied
                    .map((p) => getPlayerDisplayName(p.puuid, p.name))
                    .join(' · ')}
                </p>
                <p className="stat-number">
                  {number(leader.value)}
                  <small> {contest.unit}</small>
                </p>
                {challenger && (
                  <div className="contest-chase">
                    <p>
                      {tied.length > 1
                        ? '지금은 공동 1위. 다음 기록이 기대된다.'
                        : `${getPlayerDisplayName(challenger.puuid, challenger.name)} 추격 중 · ${number(gap)}${contest.unit} 차이`}
                    </p>
                    <div className="meter" aria-hidden="true">
                      <span
                        style={{
                          width: `${Math.min(100, (challenger.value / leader.value) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                <details className="score-help">
                  <summary>네 명의 순위 보기</summary>
                  {ranked.map((p) => (
                    <div
                      className="flex justify-between gap-2 py-1"
                      key={p.puuid}
                    >
                      <Link
                        href={`/players/${encodeURIComponent(p.puuid)}?date=${date}`}
                      >
                        {getPlayerDisplayName(p.puuid, p.name)}
                      </Link>
                      <span>
                        {number(p.value)} · {p.count}판
                      </span>
                    </div>
                  ))}
                </details>
              </article>
            )
          })}
        </div>
      )}
      <details className="surface disclosure">
        <summary>
          🏅 메달 수집 현황 <span>단독 수상 횟수</span>
        </summary>
        <div className="medal-grid">
          {MEDALS.map((medal) => (
            <article className="soft-card" key={medal.id}>
              <h3>
                {medal.emoji} {medal.name}
              </h3>
              {[...players]
                .sort(
                  (a, b) =>
                    (badgeCounts.get(b.puuid)?.[medal.id] ?? 0) -
                    (badgeCounts.get(a.puuid)?.[medal.id] ?? 0),
                )
                .map((p) => (
                  <div
                    key={p.puuid}
                    className="flex justify-between gap-2 py-1 text-sm"
                  >
                    <span>{getPlayerDisplayName(p.puuid, p.game_name)}</span>
                    <strong>{badgeCounts.get(p.puuid)?.[medal.id] ?? 0}</strong>
                  </div>
                ))}
            </article>
          ))}
        </div>
      </details>
      <details className="surface disclosure">
        <summary>
          🎯 역할별 승률 <span>10경기 이상</span>
        </summary>
        <div className="grid gap-3 sm:grid-cols-2">
          {players.map((p) => (
            <div key={p.puuid} className="soft-card">
              <h3>{getPlayerDisplayName(p.puuid, p.game_name)}</h3>
              {bestRoles.has(p.puuid) ? (
                <>
                  <p className="text-sm mt-2">
                    잘 맞았던 역할 · {bestRoles.get(p.puuid)!.role}{' '}
                    {bestRoles.get(p.puuid)!.winRate}% (
                    {bestRoles.get(p.puuid)!.games}판)
                  </p>
                  <p className="muted text-sm mt-1">
                    더 지켜볼 역할 · {worstRoles.get(p.puuid)!.role}{' '}
                    {worstRoles.get(p.puuid)!.winRate}% (
                    {worstRoles.get(p.puuid)!.games}판)
                  </p>
                </>
              ) : (
                <p className="muted text-sm mt-2">
                  이 기간에 10판 이상 플레이한 역할이 없어요.
                </p>
              )}
            </div>
          ))}
        </div>
        {bestComp && (
          <div className="soft-card mt-4">
            <h3>가장 승률이 높았던 챔피언 조합</h3>
            <div className="flex flex-wrap gap-3 mt-3">
              {bestComp.champions.map((name) => (
                <div key={name} className="flex items-center gap-2">
                  <ChampionAvatar name={name} size={28} />
                  <span>{names[name] ?? name}</span>
                </div>
              ))}
            </div>
            <p className="muted text-sm mt-2">
              {bestComp.games}전 {bestComp.wins}승 · {bestComp.winRate}%
            </p>
          </div>
        )}
      </details>
      <details className="surface disclosure">
        <summary>
          🏛️ 역대 마일스톤 <span>조회한 전체 경기 기준</span>
        </summary>
        <div className="medal-grid">
          {nicknames.map((award) => (
            <article className="soft-card" key={award.id}>
              <h3>
                {award.emoji} {award.name}
              </h3>
              <p className="mt-2 font-bold">{award.winner}</p>
              <p className="muted text-sm">{award.description}</p>
              <p className="text-sm mt-2">{award.valueLabel}</p>
              {award.gapLabel && (
                <p className="muted text-xs mt-1">{award.gapLabel}</p>
              )}
            </article>
          ))}
        </div>
      </details>
    </section>
  )
}
