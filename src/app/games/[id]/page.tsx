import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchGameById, fetchGames } from '@/lib/games'
import { getPlayerDisplayName } from '@/lib/config'
import { fetchChampionNames } from '@/lib/championNames'
import { getAugmentName } from '@/lib/augmentHighlight'
import { calculateMedals, MEDAL_DOMINANCE } from '@/lib/medals'
import {
  displayDate,
  duration,
  gameHref,
  homeHref,
  kstDate,
  validDate,
} from '@/lib/experience'
import { ChampionAvatar, ScoreHelp } from '@/components/GameUI'

export default async function GameDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const [game, allGames, names] = await Promise.all([
    fetchGameById(id),
    fetchGames(),
    fetchChampionNames(),
  ])
  if (!game) notFound()
  const date = validDate(query.date) ? query.date : kstDate(game.played_at)
  const sorted = [...game.game_results]
    .filter((r) => r.players)
    .sort((a, b) => b.perf_score - a.perf_score)
  const medals = calculateMedals(sorted)
  const index = allGames.findIndex((g) => g.id === id)
  const older = index >= 0 ? allGames[index + 1] : undefined
  const newer = index > 0 ? allGames[index - 1] : undefined
  const number = (n: number) => n.toLocaleString('ko-KR')
  const playerName = (r: (typeof sorted)[number]) =>
    getPlayerDisplayName(r.players!.puuid, r.players!.game_name)
  return (
    <div className="space-y-6">
      <Link
        href={
          kstDate(game.played_at) === date
            ? homeHref(date, game.id)
            : `${homeHref(date)}#matches`
        }
        className="text-link"
      >
        ← 보던 날짜의 경기로
      </Link>
      <header
        className={`game-banner ${game.our_team_win ? 'is-win' : 'is-loss'}`}
      >
        <p className="eyebrow">OUR MATCH REPORT</p>
        <h1>
          {game.our_team_win ? '이 판은 우리 거.' : '다음 판에 갚아준다.'}
        </h1>
        <p className="text-sm">
          <strong>{game.our_team_win ? '승리' : '패배'}</strong> ·{' '}
          {displayDate(game.played_at, true)} ·{' '}
          {duration(game.duration_seconds)} · 한국 시간
        </p>
        <details className="score-help">
          <summary>경기 번호</summary>
          <p>{game.match_id}</p>
        </details>
      </header>
      <div className="section-heading">
        <h2>플레이어별 기록</h2>
        <span className="pill">기여도 높은 순</span>
      </div>
      <section
        className="surface overflow-hidden game-desktop-results"
        aria-label="선수별 기록 표"
      >
        <table className="game-stats-table">
          <thead>
            <tr>
              <th>선수 · 챔피언</th>
              <th>킬 / 데스 / 어시</th>
              <th>준 피해</th>
              <th>받은 피해</th>
              <th>회복</th>
              <th>기여도</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((result, i) => (
              <tr key={result.id}>
                <td>
                  <div className="game-player">
                    <ChampionAvatar
                      name={result.champion_name}
                      label={names[result.champion_name]}
                    />
                    <div>
                      <Link
                        href={`/players/${encodeURIComponent(result.players!.puuid)}?date=${date}`}
                        className="font-bold"
                      >
                        {i === 0 ? '👑 ' : ''}
                        {playerName(result)}
                      </Link>
                      <p className="muted text-xs">
                        {names[result.champion_name] ?? result.champion_name}
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  {result.kills} / {result.deaths} / {result.assists}
                </td>
                <td>{number(result.damage_dealt)}</td>
                <td>{number(result.damage_taken)}</td>
                <td>{number(result.healing)}</td>
                <td className="score">{Math.round(result.perf_score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="game-mobile-results" aria-label="선수별 경기 기록">
        {sorted.map((result, i) => (
          <article className="surface game-player-card" key={result.id}>
            <div className="game-player">
              <ChampionAvatar
                name={result.champion_name}
                label={names[result.champion_name]}
                size={44}
              />
              <div>
                <Link
                  href={`/players/${encodeURIComponent(result.players!.puuid)}?date=${date}`}
                  className="font-bold"
                >
                  {i === 0 ? '👑 ' : ''}
                  {playerName(result)}
                </Link>
                <p className="muted text-xs">
                  {names[result.champion_name] ?? result.champion_name}
                </p>
              </div>
              <strong className="score">
                {Math.round(result.perf_score)}
                <small className="text-xs">점</small>
              </strong>
            </div>
            <div className="game-player-kda">
              <span className="muted text-xs">킬 / 데스 / 어시</span>
              <strong>
                {result.kills} / {result.deaths} / {result.assists}
              </strong>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.augment_ids?.map((augment, j) => (
                <span key={`${augment}-${j}`} className="augment-pill">
                  {getAugmentName(augment)}
                </span>
              ))}
            </div>
            <details className="score-help">
              <summary>딜·탱킹 등 세부 지표</summary>
              <div className="game-extra-stats">
                {[
                  ['준 피해', result.damage_dealt],
                  ['받은 피해', result.damage_taken],
                  ['회복', result.healing],
                  ['어시스트', result.assists],
                  ['CC', result.cc_score],
                  ['골드', result.gold_earned],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{number(Number(value))}</strong>
                  </div>
                ))}
              </div>
            </details>
          </article>
        ))}
      </section>
      <ScoreHelp />
      {medals.length > 0 && (
        <section className="surface profile-section">
          <div className="section-heading">
            <h2>🏅 이번 판 수상자</h2>
            <span className="muted text-xs">눌러서 수상 근거 보기</span>
          </div>
          <div className="medal-grid mt-4">
            {medals.map(({ medal, winners }) => {
              const target = Number(winners[0][medal.field])
              const others = sorted.filter(
                (r) => Number(r[medal.field]) !== target,
              )
              const average =
                others.reduce((sum, r) => sum + Number(r[medal.field]), 0) /
                (others.length || 1)
              return (
                <details key={medal.id} className="soft-card">
                  <summary>
                    <span className="text-xl">{medal.emoji}</span>
                    <h3 className="inline ml-2">{medal.name}</h3>
                    <p className="text-sm font-bold mt-2">
                      {winners.map(playerName).join(' · ')}
                    </p>
                    <p className="muted text-xs mt-1">{medal.description}</p>
                  </summary>
                  <p className="text-sm mt-3">
                    수상자 {number(target)} · 나머지 참가자 평균{' '}
                    {average.toLocaleString('ko-KR', {
                      maximumFractionDigits: 1,
                    })}
                  </p>
                  <p className="muted text-xs mt-2">
                    {medal.alwaysAward
                      ? '기여도 최고점에 수여합니다. 동점은 공동 수상입니다.'
                      : `최고·최저 기록이면서 나머지 참가자 평균${medal.direction === 'highest' ? `의 ${medal.dominance ?? MEDAL_DOMINANCE}배 이상` : `을 ${medal.dominance ?? MEDAL_DOMINANCE}로 나눈 값 이하`}일 때 수여합니다.`}
                  </p>
                </details>
              )
            })}
          </div>
        </section>
      )}
      <section className="surface profile-section game-desktop-results">
        <h2>✦ 함께 고른 증강</h2>
        <div className="grid gap-5 sm:grid-cols-2 mt-4">
          {sorted.map((r) => (
            <div key={r.id}>
              <p className="text-sm font-bold mb-2">
                {playerName(r)} · {names[r.champion_name] ?? r.champion_name}
              </p>
              <div className="flex flex-wrap gap-2">
                {r.augment_ids?.length ? (
                  r.augment_ids.map((aug, i) => (
                    <span key={`${aug}-${i}`} className="augment-pill">
                      {getAugmentName(aug)}
                    </span>
                  ))
                ) : (
                  <span className="muted text-xs">기록된 증강 없음</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      <nav className="game-pager" aria-label="인접 경기">
        {older ? (
          <Link className="button-secondary" href={gameHref(older, date)}>
            ← 이전 경기
          </Link>
        ) : (
          <span />
        )}
        {newer && (
          <Link className="button-secondary" href={gameHref(newer, date)}>
            다음 경기 →
          </Link>
        )}
      </nav>
    </div>
  )
}
