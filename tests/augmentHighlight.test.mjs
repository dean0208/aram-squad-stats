import assert from 'node:assert/strict'
import test from 'node:test'

import { getAugmentHighlight } from '../src/lib/augmentHighlight.ts'

test('승패 차이가 가장 큰 증강을 오늘의 증강으로 고른다', () => {
  const highlight = getAugmentHighlight([
    { our_team_win: true, augment_ids: [101, 102] },
    { our_team_win: true, augment_ids: [101] },
    { our_team_win: false, augment_ids: [102] },
  ])

  assert.deepEqual(highlight, { id: 101, games: 2, wins: 2 })
})

test('선택된 증강이 없으면 null을 반환한다', () => {
  assert.equal(getAugmentHighlight([{ our_team_win: true, augment_ids: [] }]), null)
})
