import test from 'node:test'
import assert from 'node:assert/strict'

import { getLatestGameDate } from '../src/lib/dateSelection.ts'

test('가장 최근 유효한 경기 날짜를 첫 화면 날짜로 고른다', () => {
  assert.equal(getLatestGameDate([
    { played_at: '2026-08-01T10:00:00Z' },
    { played_at: '2026-08-30T10:00:00Z' },
    { played_at: 'invalid' },
  ]), '2026-08-30')
})

test('게임 데이터가 없을 때만 fallback 날짜를 사용한다', () => {
  assert.equal(getLatestGameDate([], '2026-08-30'), '2026-08-30')
  assert.equal(getLatestGameDate([{ played_at: 'invalid' }], '2026-08-30'), '2026-08-30')
})
