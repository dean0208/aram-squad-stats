import assert from 'node:assert/strict'
import test from 'node:test'

import { celebrationKey, resolveCelebrationPlan } from '../src/lib/mvpCelebration.ts'

const base = {
  date: '2026-09-06',
  isLatestDate: true,
  mvpResultId: 'game-result-1',
  anchorPuuid: 'puuid-b',
  lastMvpKey: null,
  lastAnchorKey: null,
}

test('키는 날짜와 대상을 함께 담는다', () => {
  assert.equal(celebrationKey('2026-09-06', 'x'), '2026-09-06:x')
  // 같은 사람이 이틀 연속 뽑혀도 날짜가 달라 구분된다.
  assert.notEqual(celebrationKey('2026-09-06', 'x'), celebrationKey('2026-09-07', 'x'))
})

test('둘 다 처음이면 둘 다 띄운다', () => {
  const plan = resolveCelebrationPlan(base)
  assert.equal(plan.mvpKey, '2026-09-06:game-result-1')
  assert.equal(plan.anchorKey, '2026-09-06:puuid-b')
})

test('MVP 만 바뀌면 MVP 만 띄운다', () => {
  const plan = resolveCelebrationPlan({
    ...base,
    lastMvpKey: '2026-09-06:old-result',
    lastAnchorKey: '2026-09-06:puuid-b',
  })
  assert.equal(plan.mvpKey, '2026-09-06:game-result-1')
  assert.equal(plan.anchorKey, null)
})

test('걸배이만 바뀌면 걸배이만 띄운다', () => {
  const plan = resolveCelebrationPlan({
    ...base,
    lastMvpKey: '2026-09-06:game-result-1',
    lastAnchorKey: '2026-09-06:puuid-old',
  })
  assert.equal(plan.mvpKey, null)
  assert.equal(plan.anchorKey, '2026-09-06:puuid-b')
})

test('둘 다 그대로면 아무것도 띄우지 않는다', () => {
  const plan = resolveCelebrationPlan({
    ...base,
    lastMvpKey: '2026-09-06:game-result-1',
    lastAnchorKey: '2026-09-06:puuid-b',
  })
  assert.equal(plan, null)
})

test('지난 날짜를 넘겨볼 때는 띄우지 않는다', () => {
  assert.equal(resolveCelebrationPlan({ ...base, isLatestDate: false }), null)
})

test('그 날 경기가 없으면 대상도 없다', () => {
  assert.equal(
    resolveCelebrationPlan({ ...base, mvpResultId: null, anchorPuuid: null }),
    null,
  )
})

test('MVP 만 있고 걸배이를 못 고른 날은 MVP 만 띄운다', () => {
  // 오늘 기록이 한 명뿐이라 걸배이가 안 나오는 경우.
  const plan = resolveCelebrationPlan({ ...base, anchorPuuid: null })
  assert.equal(plan.mvpKey, '2026-09-06:game-result-1')
  assert.equal(plan.anchorKey, null)
})
