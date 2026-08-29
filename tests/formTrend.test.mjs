import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateFormTrend } from '../src/lib/formTrend.ts'

test('최근 점수가 직전 구간보다 높으면 상승세 메시지를 반환한다', () => {
  const trend = calculateFormTrend([72, 68, 75], [50, 54, 48])

  assert.equal(trend.delta, 21)
  assert.match(trend.message, /상승세|유지/)
})

test('최근 점수가 낮으면 폼이 죽었다는 응원 메시지를 반환한다', () => {
  const trend = calculateFormTrend([30, 35, 28], [55, 52, 58])

  assert.equal(trend.delta, -24)
  assert.match(trend.message, /폼다죽|기운내/)
})

test('비교할 직전 구간이 없으면 전체 최근 평균을 기준으로 계산한다', () => {
  const trend = calculateFormTrend([60, 65], [])

  assert.equal(trend.delta, 13)
  assert.match(trend.message, /상승세/)
})