import assert from 'node:assert/strict'
import test from 'node:test'

import { getGrowthStatus } from '../src/lib/growth.ts'

test('최근 평균이 전체 평균보다 15% 이상 낮으면 폼다죽이다', () => {
  assert.equal(getGrowthStatus(100, 84), '폼다죽')
})

test('최근 평균이 전체 평균보다 낮지만 15% 이내면 아쉬워다', () => {
  assert.equal(getGrowthStatus(100, 99), '아쉬워')
})

test('최근 평균이 전체 평균 이상이고 15% 미만 상승하면 좋은데?다', () => {
  assert.equal(getGrowthStatus(100, 110), '좋은데?')
})

test('최근 평균이 전체 평균보다 15% 이상 높으면 버스기사님이다', () => {
  assert.equal(getGrowthStatus(100, 115), '버스기사님')
})
