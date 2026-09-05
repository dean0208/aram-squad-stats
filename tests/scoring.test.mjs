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
