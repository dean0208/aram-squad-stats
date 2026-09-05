import assert from 'node:assert/strict'
import test from 'node:test'

import { computeAwardGap, CONTESTED_GAP_RATIO } from '../src/lib/awardGap.ts'

test('2위와 근소한 차이면 접전으로 표시한다', () => {
  const gap = computeAwardGap(10100, [10100, 10000, 9000], 'highest')

  assert.equal(gap.contested, true)
  assert.match(gap.gapLabel, /2위와 1\.0% 차/)
})

test('크게 앞서면 접전이 아니다', () => {
  const gap = computeAwardGap(30000, [30000, 10000], 'highest')

  assert.equal(gap.contested, false)
  assert.ok(gap.gapRatio > CONTESTED_GAP_RATIO)
})

test('최저값 부문도 2위 기준으로 격차를 잰다', () => {
  const gap = computeAwardGap(10, [10, 100, 200], 'lowest')

  assert.equal(gap.contested, false)
  assert.match(gap.gapLabel, /2위와 90\.0% 차/)
})

test('비교 대상이 없으면 격차를 표시하지 않는다', () => {
  const gap = computeAwardGap(50, [50, 50], 'highest')

  assert.equal(gap.gapRatio, null)
  assert.equal(gap.gapLabel, null)
  assert.equal(gap.contested, false)
})
