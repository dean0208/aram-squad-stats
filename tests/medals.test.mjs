import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateMedals, MEDAL_DOMINANCE, MEDALS } from '../src/lib/medals.ts'

const result = (id, stats) => ({
  id,
  champion_name: stats.champion ?? 'Garen',
  champion_id: 86,
  kills: stats.kills ?? 0,
  deaths: stats.deaths ?? 0,
  assists: stats.assists ?? 0,
  damage_dealt: stats.damage ?? 0,
  damage_taken: stats.taken ?? 0,
  healing: stats.healing ?? 0,
  gold_earned: stats.gold ?? 0,
  cc_score: stats.cc ?? 0,
  perf_score: stats.perf ?? 0,
  contribution_score: stats.perf ?? 0,
  augment_ids: [],
  players: { puuid: id, game_name: id },
})

const ids = (medals) => medals.map(m => m.medal.id)

test('MVP는 격차와 무관하게 항상 발급된다', () => {
  const medals = calculateMedals([
    result('a', { perf: 51, damage: 10000 }),
    result('b', { perf: 50, damage: 10100 }),
  ])

  assert.ok(ids(medals).includes('mvp'))
})

test('나머지 평균보다 크게 앞서지 않으면 메달을 주지 않는다', () => {
  const medals = calculateMedals([
    result('a', { perf: 50, damage: 10500 }),
    result('b', { perf: 50, damage: 10000 }),
  ])

  assert.ok(!ids(medals).includes('dealer'), '5% 차이로는 딜장인이 나오면 안 된다')
})

test('메달별 기준 배수를 넘으면 발급된다', () => {
  const dealerDominance = MEDALS.find(m => m.id === 'dealer').dominance ?? MEDAL_DOMINANCE
  const medals = calculateMedals([
    result('a', { perf: 50, damage: 10000 * dealerDominance + 1 }),
    result('b', { perf: 50, damage: 10000 }),
  ])

  assert.ok(ids(medals).includes('dealer'))
})

test('메달별 기준 배수는 스탯 분산에 맞게 서로 다르다', () => {
  const gold = MEDALS.find(m => m.id === 'gold').dominance
  const healer = MEDALS.find(m => m.id === 'healer').dominance

  assert.ok(gold < healer, '골드는 고르게 분포하므로 낮은 기준, 힐량은 편중되므로 높은 기준')
})

test('CC 기여가 0인 사람이 있으면 꽁꽁이가 발급된다', () => {
  const medals = calculateMedals([
    result('idle', { perf: 50, cc: 0 }),
    result('active', { perf: 50, cc: 200 }),
  ])

  assert.ok(ids(medals).includes('passive'), '이전에는 최저값 0이면 무조건 건너뛰었다')
})

test('전원 CC가 0이면 꽁꽁이를 주지 않는다', () => {
  const medals = calculateMedals([
    result('a', { perf: 50, cc: 0 }),
    result('b', { perf: 50, cc: 0 }),
  ])

  assert.ok(!ids(medals).includes('passive'))
})
