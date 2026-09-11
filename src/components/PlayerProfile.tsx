'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Game, Player, ChampionReport } from '@/lib/types'
import type { ChampionCatalogEntry } from '@/lib/championNames'
import type { NicknameAward } from '@/lib/nicknames'
import { getPlayerDisplayName } from '@/lib/config'
import { recommendChampion } from '@/lib/championRecommendations'
import { analyzeRecentFiveGames } from '@/lib/playerInsights'
import { displayDate, gameHref, homeHref } from '@/lib/experience'
import { ChampionAvatar, PlayerAvatar, ScoreHelp } from './GameUI'

export default function PlayerProfile({
  player,
  games,
  catalog,
  nicknames,
  returnDate,
}: {
  player: Player
  games: Game[]
  catalog: ChampionCatalogEntry[]
  nicknames: NicknameAward[]
  returnDate?: string
}) {
  const name = getPlayerDisplayName(player.puuid, player.game_name)
  const entries = useMemo(
    () =>
      [...games]
        .sort((a, b) => b.played_at.localeCompare(a.played_at))
        .flatMap((game) => {
          const result = game.game_results.find(
            (r) => r.players?.puuid === player.puuid,
          )
          return result ? [{ game, result }] : []
        }),
    [games, player.puuid],
  )
  const reports = useMemo(() => {
    const map = new Map<string, typeof entries>()
    for (const entry of entries) {
      const rows = map.get(entry.result.champion_name) ?? []
      rows.push(entry)
      map.set(entry.result.champion_name, rows)
    }
    return [...map]
      .map(([champion, rows]) => {
        const sum = (field: 'kills' | 'deaths' | 'assists' | 'perf_score') =>
          rows.reduce((total, r) => total + r.result[field], 0)
        const wins = rows.filter((row) => row.game.our_team_win).length
        const best = rows.reduce((a, b) =>
          a.result.perf_score >= b.result.perf_score ? a : b,
        )
        const firstWin = [...rows]
          .reverse()
          .find((row) => row.game.our_team_win)
        return {
          champion_name: champion,
          champion_id: rows[0].result.champion_id,
          games: rows.length,
          wins,
          win_rate: Math.round((wins / rows.length) * 100),
          avg_perf_score: sum('perf_score') / rows.length,
          avg_kills: sum('kills') / rows.length,
          avg_deaths: sum('deaths') / rows.length,
          avg_assists: sum('assists') / rows.length,
          avg_kda: (sum('kills') + sum('assists')) / Math.max(1, sum('deaths')),
          is_suspect:
            rows.length >= 3 &&
            wins / rows.length < 0.4 &&
            sum('perf_score') / rows.length > 50,
          high_perf_losses: rows.filter(
            (r) => !r.game.our_team_win && r.result.perf_score > 60,
          ).length,
          best,
          firstWin,
          rows,
        } satisfies ChampionReport & {
          best: typeof best
          firstWin: typeof firstWin
          rows: typeof rows
        }
      })
      .sort((a, b) => b.games - a.games)
  }, [entries])
  const names = Object.fromEntries(catalog.map((c) => [c.id, c.name]))
  const recommendation = recommendChampion(reports, catalog)
  const average =
    entries.reduce((sum, r) => sum + r.result.perf_score, 0) /
    (entries.length || 1)
  const recent = entries.slice(0, 10).reverse()
  const recentAverage =
    recent.reduce((sum, r) => sum + r.result.perf_score, 0) /
    (recent.length || 1)
  const recentDiff = recentAverage - average
  const [selected, setSelected] = useState(Math.max(0, recent.length - 1))
  const selectedGame = recent[selected]
  const bestScore = entries.reduce(
    (best, row) => Math.max(best, row.result.perf_score),
    0,
  )
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('games')
  const [minGames, setMinGames] = useState(1)
  const [mode, setMode] = useState('played')
  const [scoreRange, setScoreRange] = useState('all')
  const [expandedSuspects, setExpandedSuspects] = useState(false)
  const [visibleCount, setVisibleCount] = useState(12)
  const reportMap = new Map(reports.map((r) => [r.champion_name, r]))
  const atlas = [
    ...catalog,
    ...reports
      .filter((r) => !names[r.champion_name])
      .map((r) => ({ id: r.champion_name, name: r.champion_name, tags: [] })),
  ]
    .filter((champion) => {
      const report = reportMap.get(champion.id)
      return (
        `${champion.name} ${champion.id}`
          .toLowerCase()
          .includes(search.toLowerCase().trim()) &&
        (mode === 'unplayed' ? !report : mode === 'all' ? true : !!report) &&
        (!report ? mode !== 'played' : report.games >= minGames) &&
        (scoreRange === 'all' ||
          (!!report &&
            (scoreRange === 'high'
              ? report.avg_perf_score >= 50
              : report.avg_perf_score < 50)))
      )
    })
    .sort((a, b) => {
      const ar = reportMap.get(a.id),
        br = reportMap.get(b.id)
      const av =
        sort === 'score'
          ? ar?.avg_perf_score
          : sort === 'wins'
            ? ar?.win_rate
            : ar?.games
      const bv =
        sort === 'score'
          ? br?.avg_perf_score
          : sort === 'wins'
            ? br?.win_rate
            : br?.games
      return (bv ?? -1) - (av ?? -1) || a.name.localeCompare(b.name, 'ko')
    })
  const suspects = reports.filter((r) => r.is_suspect)
  const roleNames: Record<string, string> = {
    Marksman: '원딜',
    Mage: '마법사',
    Tank: '탱커',
    Fighter: '브루저',
    Support: '서포터',
    Assassin: '암살자',
  }
  const roleCounts = new Map<string, number>()
  for (const { result } of entries.slice(0, 5)) {
    const role =
      catalog.find((c) => c.id === result.champion_name)?.tags[0] ?? ''
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1)
  }
  const recentRole =
    roleNames[[...roleCounts].sort((a, b) => b[1] - a[1])[0]?.[0]] ?? '플레이어'
  const analysis = analyzeRecentFiveGames(
    entries.slice(0, 5).map(({ game, result }) => {
      const others = game.game_results.filter((r) => r.players)
      const avg = (field: 'damage_dealt' | 'assists' | 'deaths') =>
        others.reduce((sum, r) => sum + r[field], 0) / (others.length || 1)
      return {
        champion: result.champion_name,
        win: game.our_team_win,
        kills: result.kills,
        deaths: result.deaths,
        assists: result.assists,
        damage: result.damage_dealt,
        teamDamageAverage: avg('damage_dealt'),
        teamAssistsAverage: avg('assists'),
        teamDeathsAverage: avg('deaths'),
        perf: result.perf_score,
      }
    }),
    recentRole,
  )
  return (
    <div className="space-y-6">
      <Link className="text-link" href={`${homeHref(returnDate)}#players`}>
        ← 개인 기록 목록
      </Link>
      <header className="surface player-hero">
        <div className="player-identity">
          <PlayerAvatar puuid={player.puuid} name={name} size={64} />
          <div>
            <p className="eyebrow">PLAYER STATS</p>
            <h1>{name}</h1>
            <p className="muted text-sm mt-1">
              {nicknames[0]
                ? `${nicknames[0].emoji} ${nicknames[0].name}`
                : '다음 타이틀의 주인공은?'}{' '}
              · #{player.tag_line}
            </p>
          </div>
        </div>
        <div className="player-stat-grid">
          <div>
            <strong>{Math.round(average)}</strong>
            <span>평균 기여도</span>
          </div>
          <div>
            <strong>
              {recentDiff >= 0 ? '+' : ''}
              {recentDiff.toFixed(1)}
            </strong>
            <span>최근 {recent.length}판 변화</span>
          </div>
          <div>
            <strong>{Math.round(bestScore)}</strong>
            <span>개인 최고점</span>
          </div>
        </div>
        <p className="muted text-xs mt-4">
          조회한 {entries.length}경기 ·{' '}
          {entries.filter((r) => r.game.our_team_win).length}승 · 챔피언{' '}
          {reports.length}종 · 기록 기준
        </p>
      </header>
      <nav className="flex flex-wrap gap-4" aria-label="개인 기록 메뉴">
        <a className="text-link" href="#form">
          최근 경기 ↓
        </a>
        <a className="text-link" href="#atlas">
          챔피언 도감 ↓
        </a>
        {nicknames.length > 0 && (
          <a className="text-link" href="#titles">
            내 타이틀 ↓
          </a>
        )}
      </nav>
      <section className="surface profile-section" id="form">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RECENT FORM</p>
            <h2>최근 기여도 추이</h2>
          </div>
          <span className="pill">최근 {recent.length}경기</span>
        </div>
        {!recent.length ? (
          <p className="empty-state">첫 경기를 기다리고 있어요.</p>
        ) : (
          <>
            <div className="form-bars" aria-label="최근 기여도, 왼쪽이 과거">
              {recent.map((entry, i) => (
                <button
                  key={entry.game.id}
                  aria-pressed={selected === i}
                  onClick={() => setSelected(i)}
                  aria-label={`${displayDate(entry.game.played_at, true)} ${names[entry.result.champion_name] ?? entry.result.champion_name} ${Math.round(entry.result.perf_score)}점`}
                >
                  <span>{Math.round(entry.result.perf_score)}</span>
                  <span
                    className="bar"
                    style={{
                      height: `${Math.max(3, entry.result.perf_score)}%`,
                    }}
                  />
                  <small>{entry.game.our_team_win ? '승' : '패'}</small>
                </button>
              ))}
            </div>
            <p className="flex justify-between muted text-xs mt-2">
              <span>과거</span>
              <span>막대를 눌러 경기 확인</span>
              <span>최신</span>
            </p>
            {selectedGame && (
              <div className="form-selected">
                <ChampionAvatar
                  name={selectedGame.result.champion_name}
                  label={names[selectedGame.result.champion_name]}
                  size={36}
                />
                <div>
                  <p className="text-sm font-bold">
                    {names[selectedGame.result.champion_name] ??
                      selectedGame.result.champion_name}{' '}
                    · {Math.round(selectedGame.result.perf_score)}점
                  </p>
                  <p className="muted text-xs">
                    {displayDate(selectedGame.game.played_at, true)} ·{' '}
                    {selectedGame.game.our_team_win ? '승리' : '패배'}
                  </p>
                </div>
                <Link
                  className="text-link ml-auto"
                  href={gameHref(selectedGame.game, returnDate)}
                >
                  경기 보기 →
                </Link>
              </div>
            )}
          </>
        )}
        <details className="score-help mt-4">
          <summary>{analysis.headline} · 숫자로 돌아보기</summary>
          {analysis.details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
        </details>
        <ScoreHelp />
      </section>
      {recommendation && (
        <aside className="surface profile-section">
          <p className="eyebrow">🎲 추천 챔피언</p>
          <div className="flex gap-3 items-center">
            <ChampionAvatar
              name={recommendation.championId}
              label={recommendation.championName}
            />
            <div>
              <h3>{recommendation.championName}</h3>
              <p className="muted text-sm mt-1">{recommendation.reason}</p>
            </div>
          </div>
        </aside>
      )}
      <section id="atlas" className="surface profile-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CHAMPION COLLECTION</p>
            <h2>{name}의 챔피언 도감</h2>
          </div>
          <span className="pill">{reports.length}종 플레이</span>
        </div>
        <p className="muted text-xs mt-2">
          기여도와 승률을 함께 보세요. 카드를 누르면 최고점·첫 승·최근 경기를 볼
          수 있어요.
        </p>
        <div className="atlas-controls">
          <input
            className="field search"
            aria-label="챔피언 검색"
            placeholder="챔피언 이름 검색"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setVisibleCount(12)
            }}
          />
          <label>
            정렬
            <select
              className="field"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value)
                setVisibleCount(12)
              }}
            >
              <option value="games">많이 한 순</option>
              <option value="score">기여도순</option>
              <option value="wins">승률순</option>
            </select>
          </label>
          <label>
            최소
            <select
              className="field"
              value={minGames}
              onChange={(e) => {
                setMinGames(Number(e.target.value))
                setVisibleCount(12)
              }}
            >
              {[1, 3, 5, 10].map((n) => (
                <option value={n} key={n}>
                  {n}경기
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap justify-between gap-3 mb-4">
          <div className="segmented" aria-label="챔피언 수집 상태">
            {[
              ['played', '플레이한'],
              ['unplayed', '미도전'],
              ['all', '전체'],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={mode === key}
                onClick={() => {
                  setMode(key)
                  setVisibleCount(12)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="muted text-xs">
            점수 구간{' '}
            <select
              className="field"
              value={scoreRange}
              onChange={(e) => {
                setScoreRange(e.target.value)
                setVisibleCount(12)
              }}
            >
              <option value="all">전체</option>
              <option value="high">50점 이상</option>
              <option value="low">50점 미만</option>
            </select>
          </label>
        </div>
        <p className="muted text-xs mb-3">
          {atlas.length}종 ·{' '}
          {mode === 'unplayed'
            ? '조회한 기록에서 플레이하지 않은 챔피언'
            : '평균값은 경기 수와 함께 확인해 주세요'}
        </p>
        {!atlas.length ? (
          <div className="empty-state">
            <p>조건에 맞는 챔피언이 없어요.</p>
            <button
              className="text-link mt-2"
              onClick={() => {
                setSearch('')
                setMode('played')
                setMinGames(1)
                setScoreRange('all')
              }}
            >
              검색 조건 초기화
            </button>
          </div>
        ) : (
          <div className="atlas-grid">
            {atlas.slice(0, visibleCount).map((champion) => {
              const report = reportMap.get(champion.id)
              return (
                <details className="atlas-card" key={champion.id}>
                  <summary>
                    <div className="atlas-identity">
                      <ChampionAvatar
                        name={champion.id}
                        label={champion.name}
                        size={40}
                      />
                      <div>
                        <h3>{champion.name}</h3>
                        <p className="muted text-xs">
                          {report ? `${report.games}경기` : '아직 미도전'}
                        </p>
                      </div>
                    </div>
                    {report && (
                      <div className="atlas-stats">
                        <div>
                          <strong>{Math.round(report.avg_perf_score)}점</strong>
                          <span>평균 기여도</span>
                        </div>
                        <div>
                          <strong>{report.win_rate}%</strong>
                          <span>
                            {report.wins}승 {report.games - report.wins}패
                          </span>
                        </div>
                      </div>
                    )}
                  </summary>
                  {report ? (
                    <>
                      <div className="atlas-history">
                        <p>
                          최고 {Math.round(report.best.result.perf_score)}점{' '}
                          <Link
                            className="text-link"
                            href={gameHref(report.best.game, returnDate)}
                          >
                            경기 →
                          </Link>
                        </p>
                        <p>
                          첫 승{' '}
                          {report.firstWin ? (
                            <Link
                              className="text-link"
                              href={gameHref(report.firstWin.game, returnDate)}
                            >
                              {displayDate(report.firstWin.game.played_at)} →
                            </Link>
                          ) : (
                            '아직 기다리는 중'
                          )}
                        </p>
                        <p className="muted mt-2">
                          평균 {report.avg_kills.toFixed(1)} /{' '}
                          {report.avg_deaths.toFixed(1)} /{' '}
                          {report.avg_assists.toFixed(1)}
                        </p>
                        <div className="mt-2">
                          {report.rows.slice(0, 3).map((row) => (
                            <Link
                              className="text-link block"
                              key={row.game.id}
                              href={gameHref(row.game, returnDate)}
                            >
                              {displayDate(row.game.played_at)} ·{' '}
                              {row.game.our_team_win ? '승' : '패'} ·{' '}
                              {Math.round(row.result.perf_score)}점 →
                            </Link>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="muted text-xs mt-3">
                      뽑을 기회가 생기면 첫 기록을 남겨보세요.
                    </p>
                  )}
                </details>
              )
            })}
          </div>
        )}
        {atlas.length > visibleCount && (
          <button
            className="button-secondary mt-5"
            onClick={() => setVisibleCount((n) => n + 12)}
          >
            12종 더 보기 · 남은 {atlas.length - visibleCount}종
          </button>
        )}
      </section>
      {suspects.length > 0 && (
        <section className="surface profile-section">
          <h2>🔍 승률 체크</h2>
          <p className="muted text-sm mt-2">
            평균 기여도 50점 초과·승률 40% 미만·3경기 이상. 기여도와 승패가
            달랐던 픽이에요.
          </p>
          <div className="suspect-list">
            {(expandedSuspects ? suspects : suspects.slice(0, 3)).map((r) => (
              <div className="soft-card" key={r.champion_name}>
                <div className="flex gap-2 items-center">
                  <ChampionAvatar
                    name={r.champion_name}
                    label={names[r.champion_name]}
                    size={32}
                  />
                  <h3>{names[r.champion_name] ?? r.champion_name}</h3>
                </div>
                <p className="text-sm mt-3">
                  {r.win_rate}% 승률 · 평균 {Math.round(r.avg_perf_score)}점
                </p>
                <p className="muted text-xs mt-1">
                  {r.games}전 {r.wins}승 · 60점 초과 패배 {r.high_perf_losses}회
                </p>
              </div>
            ))}
          </div>
          {suspects.length > 3 && (
            <button
              className="text-link mt-3"
              onClick={() => setExpandedSuspects((v) => !v)}
            >
              {expandedSuspects ? '접기' : `${suspects.length - 3}종 더 보기`}
            </button>
          )}
        </section>
      )}
      {nicknames.length > 0 && (
        <section id="titles" className="surface profile-section">
          <h2>🏛️ 획득 타이틀</h2>
          <div className="medal-grid mt-4">
            {nicknames.map((n) => (
              <article className="soft-card" key={n.id}>
                <h3>
                  {n.emoji} {n.name}
                </h3>
                <p className="muted text-xs mt-2">{n.description}</p>
                <p className="text-sm font-bold mt-2">{n.valueLabel}</p>
              </article>
            ))}
          </div>
          <Link
            className="text-link mt-4"
            href={`${homeHref(returnDate)}#records`}
          >
            타이틀 경쟁 보러 가기 →
          </Link>
        </section>
      )}
    </div>
  )
}
