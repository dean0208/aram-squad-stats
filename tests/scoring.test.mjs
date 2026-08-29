import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateFairScores } from '../src/lib/scoring.ts'

const participant = (puuid, stats) => ({
  puuid,
  championName: stats.championName,
  teamId: 100,
  win: stats.win ?? false,
  kills: stats.kills ?? 0,
  deaths: stats.deaths ?? 0,
  assists: stats.assists ?? 0,
  totalDamageDealtToChampions: stats.damage ?? 0,
  totalDamageTaken: stats.taken ?? 0,
  totalHeal: stats.healing ?? 0,
  totalTimeCCDealt: stats.cc ?? 0,
})

test('승리 보너스가 있어도 패배팀의 고군분투 점수는 유지된다', () => {
  const scores = calculateFairScores([
    participant('carry', { win: true, kills: 8, assists: 20, damage: 60000, taken: 25000, cc: 20 }),
    participant('effort', { win: false, kills: 4, assists: 18, damage: 45000, taken: 50000, healing: 12000, cc: 80 }),
  ])

  assert.ok(scores.get('effort') > 40)
  assert.ok(scores.get('effort') < 100)
})

test('점수는 0점에서 100점 사이이며 팀 내 기여 비율을 반영한다', () => {
  const scores = calculateFairScores([
    participant('damage', { kills: 10, damage: 90000 }),
    participant('utility', { assists: 20, taken: 70000, healing: 30000, cc: 150 }),
  ])

  for (const score of scores.values()) assert.ok(score >= 0 && score <= 100)
  assert.notEqual(scores.get('damage'), scores.get('utility'))
})

test('탱커는 같은 팀 내 피해 흡수와 CC 기여가 점수에 더 크게 반영된다', () => {
  const scores = calculateFairScores([
    participant('tank', { championName: 'Malphite', taken: 90000, cc: 120, damage: 20000 }),
    participant('carry', { championName: 'Jinx', damage: 80000, taken: 20000, cc: 20 }),
  ])

  assert.ok(scores.get('tank') > scores.get('carry'))
})
