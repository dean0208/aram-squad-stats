import assert from 'node:assert/strict'
import test from 'node:test'

import { toDisplayContributionScore } from '../src/lib/displayScore.ts'

test('원점수 0은 표시 점수도 0이다', () => {
  assert.equal(toDisplayContributionScore(0), 0)
})

test('낮은 원점수를 읽기 쉬운 100점 기준으로 보정한다', () => {
  assert.equal(toDisplayContributionScore(20), 63)
  assert.equal(toDisplayContributionScore(30), 77)
})

test('표시 점수는 100점을 넘지 않는다', () => {
  assert.equal(toDisplayContributionScore(50), 100)
  assert.equal(toDisplayContributionScore(80), 100)
})
