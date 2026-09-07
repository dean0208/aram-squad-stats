import assert from 'node:assert/strict'
import test from 'node:test'

import { toDisplayScore } from '../src/lib/displayScore.ts'

test('원점수 0 이하는 표시 점수도 0이다', () => {
  assert.equal(toDisplayScore(0), 0)
  assert.equal(toDisplayScore(-5), 0)
})

test('점수 모델이 이미 100점 기준이므로 반올림만 한다', () => {
  assert.equal(toDisplayScore(59.3), 59)
  assert.equal(toDisplayScore(60.5), 61)
  assert.equal(toDisplayScore(31), 31)
})

test('표시 점수는 100점을 넘지 않는다', () => {
  assert.equal(toDisplayScore(100), 100)
  assert.equal(toDisplayScore(120), 100)
})

test('유한한 숫자가 아니면 0으로 떨어뜨린다', () => {
  assert.equal(toDisplayScore(Number.NaN), 0)
  assert.equal(toDisplayScore(Number.POSITIVE_INFINITY), 0)
})
