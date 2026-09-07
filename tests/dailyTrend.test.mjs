import assert from 'node:assert/strict'
import test from 'node:test'

import { computeDailyTrend } from '../src/lib/dailyTrend.ts'

const all = [
  { puuid: 'a', perfScore: 60 }, { puuid: 'a', perfScore: 60 },
  { puuid: 'b', perfScore: 50 }, { puuid: 'b', perfScore: 50 },
  { puuid: 'c', perfScore: 70 }, { puuid: 'c', perfScore: 70 },
]

test('평소보다 오른 사람이 캐리, 내린 사람이 걸배이가 된다', () => {
  const today = [
    { puuid: 'a', perfScore: 80 },  // +20
    { puuid: 'b', perfScore: 55 },  //  +5
    { puuid: 'c', perfScore: 40 },  // -30
  ]
  const trend = computeDailyTrend(all, today)
  assert.equal(trend.carry.puuid, 'a')
  assert.equal(trend.anchor.puuid, 'c')
  assert.equal(trend.carry.diff, 20)
  assert.equal(trend.anchor.diff, -30)
})

test('모두 평소보다 잘한 날에도 가장 덜 오른 사람이 걸배이가 된다', () => {
  const trend = computeDailyTrend(all, [
    { puuid: 'a', perfScore: 90 },  // +30
    { puuid: 'b', perfScore: 52 },  //  +2
  ])
  assert.equal(trend.carry.puuid, 'a')
  assert.equal(trend.anchor.puuid, 'b')
  assert.ok(trend.anchor.diff > 0)
})

test('오늘 여러 판을 한 사람은 평균으로 잰다', () => {
  const trend = computeDailyTrend(all, [
    { puuid: 'a', perfScore: 40 }, { puuid: 'a', perfScore: 80 },  // 평균 60 → +0
    { puuid: 'b', perfScore: 20 },                                  // -30
  ])
  assert.equal(trend.carry.puuid, 'a')
  assert.equal(trend.carry.diff, 0)
  assert.equal(trend.anchor.puuid, 'b')
})

test('오늘 기록이 한 명뿐이면 캐리와 걸배이를 세우지 않는다', () => {
  assert.equal(computeDailyTrend(all, [{ puuid: 'a', perfScore: 80 }]), null)
})

test('전체 기록이 없는 사람은 비교 대상에서 뺀다', () => {
  const trend = computeDailyTrend(all, [
    { puuid: 'a', perfScore: 80 },
    { puuid: 'b', perfScore: 20 },
    { puuid: 'newbie', perfScore: 5 },   // 기준선이 없다
  ])
  assert.equal(trend.anchor.puuid, 'b')
  assert.ok(![trend.carry.puuid, trend.anchor.puuid].includes('newbie'))
})

test('오늘 기록이 없으면 null', () => {
  assert.equal(computeDailyTrend(all, []), null)
})
