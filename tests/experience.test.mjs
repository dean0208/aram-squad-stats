import assert from 'node:assert/strict'
import test from 'node:test'
import {
  kstDate,
  validDate,
  homeHref,
  gameHref,
  periodGames,
  contestStandings,
  CONTESTS,
  recordMoments,
  sessionSummary,
} from '../src/lib/experience.ts'

const result = (score, puuid = 'a', assists = 10) => ({
  id: puuid,
  players: { puuid, game_name: puuid },
  perf_score: score,
  assists,
  damage_dealt: 1000,
  damage_taken: 500,
  healing: 100,
  cc_score: 5,
})
const game = (day, score = 50, extra = {}) => ({
  id: day,
  played_at: `${day}T12:00:00Z`,
  game_results: [result(score)],
  duration_seconds: 600,
  our_team_win: true,
  ...extra,
})

test('KST 자정과 잘못된 날짜를 구분한다', () => {
  assert.equal(kstDate('2026-09-08T15:00:00Z'), '2026-09-09')
  assert.equal(kstDate('2026-09-08T14:59:59Z'), '2026-09-08')
  assert.equal(validDate('2026-02-30'), false)
  assert.equal(validDate('2026-09-09'), true)
  assert.equal(validDate(['2026-09-09']), false)
})
test('월요일부터 선택일까지 집계하며 미래 경기는 제외한다', () => {
  const games = [
    '2026-08-31',
    '2026-09-06',
    '2026-09-07',
    '2026-09-09',
    '2026-09-10',
  ].map((d) => game(d))
  assert.deepEqual(
    periodGames(games, '2026-09-09', 'week').map((g) => g.id),
    ['2026-09-07', '2026-09-09'],
  )
  assert.deepEqual(
    periodGames(games, '2026-09-09', 'month').map((g) => g.id),
    ['2026-09-06', '2026-09-07', '2026-09-09'],
  )
  assert.equal(periodGames(games, '2026-09-09', 'all').length, 5)
})
test('상세 링크와 복귀 링크는 선택한 날짜와 경기를 보존한다', () => {
  assert.equal(
    gameHref(game('2026-09-09'), '2026-09-06'),
    '/games/2026-09-09?date=2026-09-06',
  )
  assert.equal(
    homeHref('2026-09-06', 'g1'),
    '/?date=2026-09-06&game=g1#match-g1',
  )
  assert.equal(homeHref('bad'), '/')
})
test('점수 경쟁은 합계 대신 평균을 사용하고 공동 1위를 보존한다', () => {
  const games = [
    game('2026-09-08', 60, { game_results: [result(60), result(70, 'b')] }),
    game('2026-09-09', 80),
  ]
  const ranks = contestStandings(games, CONTESTS[0])
  assert.deepEqual(
    ranks.map((r) => r.value),
    [70, 70],
  )
  assert.equal(ranks[0].count, 2)
})
test('개인 기록 경신은 미래 최고점과 비교하지 않으며 동점은 경신이 아니다', () => {
  const games = [
    game('2026-09-10', 99),
    game('2026-09-09', 80),
    game('2026-09-08', 60),
    game('2026-09-07', 50),
    game('2026-09-06', 55),
  ]
  const moments = recordMoments(games, '2026-09-09')
  assert.equal(moments.length, 1)
  assert.equal(moments[0].previous, 60)
  assert.equal(moments[0].value, 80)
  games[1] = game('2026-09-09', 60)
  assert.equal(recordMoments(games, '2026-09-09').length, 0)
})
test('반등은 직전 50점 미만 경기에서 15점 이상 오른 때만 표시한다', () => {
  const games = [
    game('2026-09-06', 90),
    game('2026-09-07', 60),
    game('2026-09-08', 40),
    game('2026-09-09', 55),
  ]
  const moments = recordMoments(games, '2026-09-09')
  assert.equal(moments[0].label, '반등 성공')
  assert.equal(moments[0].previousGame.id, '2026-09-08')
  assert.equal(recordMoments(games.slice(2), '2026-09-09').length, 0)
})
test('영수증 요약은 승패·플레이 시간과 마지막 경기 순서를 반영한다', () => {
  const summary = sessionSummary([
    game('2026-09-08', 50, { our_team_win: false }),
    game('2026-09-09'),
  ])
  assert.deepEqual(
    [summary.wins, summary.losses, summary.seconds],
    [1, 1, 1200],
  )
  assert.equal(summary.line, '마지막 판은 챙겼다.')
  assert.equal(sessionSummary([]).wins, 0)
})
