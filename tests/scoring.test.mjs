import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateFairScores } from '../src/lib/scoring.ts'

const participant = (puuid, stats) => ({
  puuid,
  championName: stats.championName,
  win: stats.win ?? false,
  kills: stats.kills ?? 0,
  deaths: stats.deaths ?? 0,
  assists: stats.assists ?? 0,
  totalDamageDealtToChampions: stats.damage ?? 0,
  totalDamageTaken: stats.taken ?? 0,
  totalHeal: stats.healing ?? 0,
  totalTimeCCDealt: stats.cc ?? 0,
})

const GAME = { durationSeconds: 1800 }

test('패배해도 팀 내 기여가 크면 점수가 유지된다', () => {
  const scores = calculateFairScores([
    participant('effort', { kills: 12, deaths: 6, assists: 24, damage: 60000, taken: 50000, healing: 12000, cc: 80 }),
    participant('quiet', { kills: 2, deaths: 10, assists: 6, damage: 15000, taken: 20000, cc: 10 }),
  ], GAME)

  assert.ok(scores.get('effort') > 40, `기대: 40점 초과, 실제: ${scores.get('effort')}`)
  assert.ok(scores.get('effort') > scores.get('quiet'))
})

test('점수는 0에서 100 사이이며 팀 내 기여 비율을 반영한다', () => {
  const scores = calculateFairScores([
    participant('damage', { kills: 10, damage: 90000 }),
    participant('utility', { assists: 20, taken: 70000, healing: 30000, cc: 150 }),
  ], GAME)

  for (const score of scores.values()) assert.ok(score >= 0 && score <= 100)
  assert.notEqual(scores.get('damage'), scores.get('utility'))
})

test('탱커는 피해 흡수와 CC 기여가 점수에 더 크게 반영된다', () => {
  const scores = calculateFairScores([
    participant('tank', { championName: 'Malphite', taken: 90000, cc: 120, damage: 20000 }),
    participant('carry', { championName: 'Jinx', damage: 80000, taken: 20000, cc: 20 }),
  ], GAME)

  assert.ok(scores.get('tank') > scores.get('carry'))
})

test('다른 조건이 같으면 많이 죽은 쪽이 낮은 점수를 받는다', () => {
  const base = { kills: 5, assists: 10, damage: 30000, taken: 30000, healing: 5000, cc: 40 }
  const scores = calculateFairScores([
    participant('careful', { ...base, deaths: 2 }),
    participant('feeder', { ...base, deaths: 18 }),
  ], GAME)

  assert.ok(scores.get('careful') > scores.get('feeder'),
    `기대: careful > feeder, 실제 ${scores.get('careful')} vs ${scores.get('feeder')}`)
})

test('팀 전체가 잘한 판은 같은 지분이어도 점수가 더 높다', () => {
  const make = (multiplier) => [
    participant('a', { kills: 5 * multiplier, deaths: 5, assists: 10, damage: 25000 * multiplier, taken: 25000, cc: 30 }),
    participant('b', { kills: 5 * multiplier, deaths: 5, assists: 10, damage: 25000 * multiplier, taken: 25000, cc: 30 }),
  ]

  const weak = calculateFairScores(make(1), GAME)
  const strong = calculateFairScores(make(3), GAME)

  assert.ok(strong.get('a') > weak.get('a'),
    `기대: 강한 판이 더 높음, 실제 ${strong.get('a')} vs ${weak.get('a')}`)
})

test('전달된 역할 맵이 내장 폴백보다 우선한다', () => {
  const roster = [
    participant('subject', { championName: 'Jinx', taken: 90000, cc: 120, damage: 20000 }),
    participant('other', { championName: 'Garen', damage: 80000, taken: 20000, cc: 20 }),
  ]

  const asFallbackCarry = calculateFairScores(roster, GAME)
  const asTank = calculateFairScores(roster, { ...GAME, roles: { Jinx: 'tank' } })

  assert.ok(asTank.get('subject') > asFallbackCarry.get('subject'),
    '탱커로 판정되면 피해 흡수·CC 가중치가 올라가야 한다')
})

test('참가자가 없으면 빈 결과를 돌려준다', () => {
  assert.equal(calculateFairScores([], GAME).size, 0)
})

test('팀원 힐을 알면 자힐이 섞인 totalHeal 대신 그것을 쓴다', () => {
  // 탱커는 자기를 크게 회복하고(자힐 60k) 팀원은 못 살렸다.
  // 서포터는 자힐은 없지만 팀원을 20k 살렸다.
  const base = {
    win: true, kills: 2, deaths: 3, assists: 10,
    totalDamageDealtToChampions: 20000, totalDamageTaken: 40000, totalTimeCCDealt: 0,
  }
  const participants = [
    { ...base, puuid: 'tank', championName: 'Malphite', totalHeal: 60000, totalHealsOnTeammates: 0 },
    { ...base, puuid: 'sup', championName: 'Soraka', totalHeal: 20000, totalHealsOnTeammates: 20000 },
    { ...base, puuid: 'adc', championName: 'Jinx', totalHeal: 3000, totalHealsOnTeammates: 0 },
    { ...base, puuid: 'mid', championName: 'Lux', totalHeal: 3000, totalHealsOnTeammates: 0 },
  ]
  const withTeammate = calculateFairScores(participants)

  // 같은 경기를 팀원 힐 없이(옛 데이터처럼) 계산하면 탱커가 힐 지분을 독식한다.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 구조분해로 키를 빼는 관용구다.
  const legacy = calculateFairScores(participants.map(({ totalHealsOnTeammates, ...p }) => p))

  // 팀원 힐을 쓰면 실제로 팀을 살린 서포터가 이득을 본다.
  assert.ok(withTeammate.get('sup') > legacy.get('sup'))
  // 자기만 회복한 탱커는 힐 축에서 더 이상 점수를 받지 못한다.
  assert.ok(withTeammate.get('tank') < legacy.get('tank'))
})

test('팀원 힐이 없는 옛 경기는 예전과 똑같이 totalHeal 로 계산한다', () => {
  const participants = [
    { puuid: 'a', championName: 'Soraka', win: true, kills: 1, deaths: 2, assists: 12,
      totalDamageDealtToChampions: 9000, totalDamageTaken: 20000, totalHeal: 30000, totalTimeCCDealt: 0 },
    { puuid: 'b', championName: 'Jinx', win: true, kills: 9, deaths: 2, assists: 4,
      totalDamageDealtToChampions: 30000, totalDamageTaken: 15000, totalHeal: 2000, totalTimeCCDealt: 0 },
  ]
  const before = calculateFairScores(participants)
  // undefined 를 명시적으로 넘겨도 결과가 같아야 한다 (0 과 구분된다).
  const explicit = calculateFairScores(
    participants.map(p => ({ ...p, totalHealsOnTeammates: undefined })),
  )
  assert.deepEqual([...before.entries()], [...explicit.entries()])
})

test('팀원 힐 0 은 "모른다" 가 아니라 "아무도 못 살렸다" 로 센다', () => {
  const mk = (heals) => [
    { puuid: 'a', championName: 'Soraka', win: true, kills: 1, deaths: 2, assists: 12,
      totalDamageDealtToChampions: 9000, totalDamageTaken: 20000, totalHeal: 30000,
      totalHealsOnTeammates: heals, totalTimeCCDealt: 0 },
    { puuid: 'b', championName: 'Jinx', win: true, kills: 9, deaths: 2, assists: 4,
      totalDamageDealtToChampions: 30000, totalDamageTaken: 15000, totalHeal: 2000,
      totalHealsOnTeammates: 0, totalTimeCCDealt: 0 },
  ]
  // 0 을 넘기면 폴백하지 않는다 — totalHeal 30000 이 살아나면 안 된다.
  assert.notEqual(calculateFairScores(mk(0)).get('a'), calculateFairScores(mk(undefined)).get('a'))
})
