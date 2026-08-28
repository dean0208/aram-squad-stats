import assert from 'node:assert/strict'
import test from 'node:test'

import { selectMvp } from '../src/lib/mvp.ts'

test('MVP는 4명 중 순위가 아니라 실제 퍼포먼스 점수가 가장 높은 플레이어다', () => {
  const results = [
    { id: 'rank-one', perf_score: 72.4, contribution_score: 67 },
    { id: 'rank-two', perf_score: 68.1, contribution_score: 100 },
  ]

  assert.equal(selectMvp(results)?.id, 'rank-one')
})

test('MVP 후보가 없으면 null을 반환한다', () => {
  assert.equal(selectMvp([]), null)
})
